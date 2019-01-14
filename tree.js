/* jshint esversion:6 */

var vscode = require( 'vscode' );

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
    while( dot > -1 )
    {
        o = object[ p.substr( 0, dot ) ];
        p = p.substr( dot + 1 );
        dot = p.indexOf( "." );
    }
    return o[ p ];
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
        var treeItem = new vscode.TreeItem( node.label );

        treeItem.id = node.id;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

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

    populate( data )
    {
        function findNode( /* level, */ type, label, children )
        {
            var found;

            if( children === undefined )
            {
                children = nodes;
            }
            children.forEach( function( child )
            {
                if( /* child.level === level &&  */child.type === type && child.label === label )
                {
                    found = child;
                }
                else if( child.nodes !== undefined )
                {
                    found = findNode( /* level++, */ type, label, child.nodes );
                }
            }, this );

            return found;
        }

        data.map( function( entry )
        {
            for( var level = 0; level < this._structure.length; ++level )
            {
                var children = this._structure[ level ].children;
                children.map( function( property )
                {
                    var node = findNode( /* level, */ property, getProperty( entry, property ) );

                    if( node === undefined )
                    {
                        node = {
                            level: level,
                            label: getProperty( entry, property ),
                            // nodeType: this._structure[ level ].type ,
                            type: property,
                            id: ( buildCounter * 1000000 ) + nodeCounter++,
                            visible: true,
                            nodes: []
                        };

                        if( level === 0 )
                        {
                            nodes.push( node );
                        }
                        else
                        {
                            var parent = findNode( /* level - 1, */ this._structure[ level ].parent, getProperty( entry, this._structure[ level ].parent ) );
                            node.parent = parent;
                            parent.nodes.push( node );
                        }
                    }
                }, this );
            }
        }, this );

        console.log( "Done" );
    }
}

exports.TreeNodeProvider = TreeNodeProvider;
