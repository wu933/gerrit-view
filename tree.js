/* jshint esversion:6 */

var vscode = require( 'vscode' );
var path = require( 'path' );

var nodes = [];
var buildCounter = 1;
var nodeCounter = 1;

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

class TreeNodeProvider
{
    constructor( _context, _structure )
    {
        this._context = _context;
        this._structure = _structure;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
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

        treeItem.collapsibleState = node.nodes && node.nodes.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

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
        var matcher = new RegExp( text, config.showFilterCaseSensitive() ? "" : "i" );

        if( children === undefined )
        {
            children = nodes;
        }
        children.forEach( child =>
        {
            var match = matcher.test( child.label );
            child.visible = !text || match;

            if( child.visible && child.nodes !== undefined )
            {
                this.filter( text, child.nodes );
                var visibleNodes = child.nodes ? child.nodes.filter( isVisible ).length : 0;
                child.visible = visibleNodes > 0;
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

    populate( data, extractors, icons )
    {
        var locateNode = function( node )
        {
            return node.type === this.type && node.value === this.value;
        }

        data.map( function( item )
        {
            var entry = item.details;
            var parent;
            var parents = nodes;
            for( var level = 0; level < this._structure.length; ++level )
            {
                var children = this._structure[ level ].children;
                children.map( function( property )
                {
                    var value = getProperty( entry, property );
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
                            node = parent.nodes.find( locateNode, { type: property, value: value } );
                        }
                        else
                        {
                            node = nodes.find( locateNode, { type: property, value: value } );
                        }

                        if( node === undefined )
                        {
                            node = {
                                level: level,
                                value: value,
                                type: property,
                                id: ( buildCounter * 1000000 ) + nodeCounter++,
                                visible: true,
                                nodes: []
                            };

                            if( extractors[ property ] !== undefined )
                            {
                                node.label = extractors[ property ]( entry );
                            }
                            if( icons[ property ] !== undefined )
                            {
                                node.icon = icons[ property ]( entry );
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
                    }
                }, this );
                if( level > 0 && parent !== undefined )
                {
                    parents = parent.nodes;
                }
            }
        }, this );
    }
}

exports.TreeNodeProvider = TreeNodeProvider;
