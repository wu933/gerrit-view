/* jshint esversion:6 */

var vscode = require( 'vscode' );
var path = require( 'path' );

var nodes = [];
var expandedNodes = {};

var isVisible = function( e )
{
    return e.visible === true;
};

var getProperty = function( object, path )
{
    var o = object;
    var p = path;
    var dot = p.indexOf( "." );
    while( o && dot > -1 )
    {
        o = object[ p.substr( 0, dot ) ];
        p = p.substr( dot + 1 );
        dot = p.indexOf( "." );
    }
    return o && o[ p ];
};

function forEach( callback, children )
{
    if( children === undefined )
    {
        children = nodes;
    }
    children.forEach( child =>
    {
        if( child.nodes !== undefined )
        {
            forEach( callback, child.nodes );
        }
        callback( child );
    } );
}

class TreeNodeProvider
{
    constructor( _context, _structure )
    {
        this._context = _context;
        this._structure = _structure;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        expandedNodes = _context.workspaceState.get( 'expandedNodes', {} );
    }

    getChildren( node )
    {
        if( node === undefined )
        {
            var availableNodes = nodes.filter( function( node )
            {
                return node.nodes === undefined || node.nodes.length > 0;
            } );
            var rootNodes = availableNodes.filter( isVisible );
            if( rootNodes.length > 0 )
            {
                return rootNodes;
            }

            return [ { label: "Nothing found", empty: availableNodes.length === 0 } ];
        }
        else if( node.nodes && node.nodes.length > 0 )
        {
            return node.nodes.filter( isVisible );
        }
        return undefined;
    }

    getParent( node )
    {
        return node.parent;
    }

    getTreeItem( node )
    {
        var treeItem = new vscode.TreeItem( node.label ? node.label : node.value );

        treeItem.id = node.id;
        treeItem.tooltip = node.id;

        if( node.nodes.length > 0 )
        {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            if( expandedNodes[ node.id ] !== undefined )
            {
                treeItem.collapsibleState = ( expandedNodes[ node.id ] === true ) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
            }
        }

        if( node.icon !== undefined )
        {
            var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", node.icon + ".svg" ) );
            var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", node.icon + ".svg" ) );

            treeItem.iconPath = {
                dark: darkIconPath,
                light: lightIconPath
            };
        }

        return treeItem;
    }

    clear()
    {
        nodes = [];
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }

    filter( text, children )
    {
        var matcher = new RegExp( text, vscode.workspace.getConfiguration( 'gerrit-view' ).get( 'showFilterCaseSensitive' ) ? "" : "i" );

        if( children === undefined )
        {
            children = nodes;
        }
        children.forEach( child =>
        {
            var match = matcher.test( child.label );

            if( child.nodes !== undefined )
            {
                this.filter( text, child.nodes );
                var visibleNodes = child.nodes ? child.nodes.filter( isVisible ).length : 0;
                child.visible = visibleNodes > 0;
            }
            else
            {
                child.visible = !text || match;
            }
        } );
    }

    clearFilter( children )
    {
        if( children === undefined )
        {
            children = nodes;
        }
        children.forEach( function( child )
        {
            child.visible = true;
            if( child.nodes !== undefined )
            {
                this.clearFilter( child.nodes );
            }
        }, this );
    }

    populate( data, icons )
    {
        var locateNode = function( node )
        {
            return node.type === this.type && node.value === this.value;
        };

        forEach( function( node ) { node.delete = true; }, nodes );

        var rootCounter = 1;

        data.map( function( item, index )
        {
            var entry = item.details;
            var parent;
            var parents = nodes;

            for( var level = 0; level < this._structure.length; ++level )
            {
                var children = this._structure[ level ].children;
                children.map( function( child )
                {
                    var value = getProperty( entry, child.property );

                    if( value !== undefined )
                    {
                        var node;

                        if( level > 0 )
                        {
                            parent = parents.find( locateNode, {
                                type: this._structure[ level ].parent,
                                value: getProperty( entry, this._structure[ level ].parent )
                            } );
                        }

                        if( parent !== undefined )
                        {
                            node = parent.nodes.find( locateNode, { type: child.property, value: value } );
                        }
                        else
                        {
                            node = nodes.find( locateNode, { type: child.property, value: value } );
                        }

                        if( node === undefined )
                        {
                            node = {
                                level: level,
                                value: value,
                                type: child.property,
                                id: parent ? ( parent.id + "." + ( parent.nodes.length + 1 ) ) : ( rootCounter++ ).toString(),
                                visible: true,
                                nodes: []
                            };

                            if( child.format !== undefined )
                            {
                                var label = child.format;
                                var regex = new RegExp( "\\$\\{(.*?)\\}", "g" );
                                label = label.replace( regex, function( match, name )
                                {
                                    return getProperty( entry, name );
                                } );
                                node.label = label;
                            }

                            if( icons[ child.property ] !== undefined )
                            {
                                node.icon = icons[ child.property ]( entry );
                            }

                            if( level === 0 )
                            {
                                nodes.push( node );
                            }
                            else
                            {
                                node.parent = parent;
                                parent.nodes.push( node );
                            }
                        }
                        else
                        {
                            node.delete = false;
                        }
                    }
                }, this );
                if( level > 0 && parent !== undefined )
                {
                    parents = parent.nodes;
                }
            }
        }, this );

        this.prune();
    }

    prune( children )
    {
        function removeDeletedNodes( children, me )
        {
            return children.filter( function( child )
            {
                if( child.nodes !== undefined )
                {
                    child.nodes = me.prune( child.nodes );
                }
                var shouldRemove = child.delete === true;
                if( shouldRemove === true )
                {
                    delete expandedNodes[ child.id ];
                }
                return shouldRemove === false;
            }, me );
        }

        var root;

        if( children === undefined )
        {
            root = true;
            children = nodes;
        }

        children = removeDeletedNodes( children, this );

        if( root === true )
        {
            nodes = children;
        }

        return children;
    }

    setExpanded( path, expanded )
    {
        expandedNodes[ path ] = expanded;
        this._context.workspaceState.update( 'expandedNodes', expandedNodes );
    }

    clearExpansionState()
    {
        expandedNodes = {};
        this._context.workspaceState.update( 'expandedNodes', expandedNodes );
    }
}

exports.TreeNodeProvider = TreeNodeProvider;
