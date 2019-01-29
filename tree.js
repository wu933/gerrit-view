/* jshint esversion:6 */

var vscode = require( 'vscode' );
var path = require( 'path' );
var fs = require( 'fs' );
var octicons = require( 'octicons' );
var objectUtils = require( './objectUtils.js' );

var storageLocation;

var nodes = [];
var expandedNodes = {};
var hashes = {};
var keys = new Set();
var visibleEntries = new Set();

var showChanged = false;

function hash( text )
{
    var hash = 0;
    if( text.length === 0 )
    {
        return hash;
    }
    for( var i = 0; i < text.length; i++ )
    {
        var char = text.charCodeAt( i );
        hash = ( ( hash << 5 ) - hash ) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    hash = Math.abs( hash ) % 1000000;

    return hash;
}

var isVisible = function( e )
{
    // var result = e.visible === true && ( showChanged === false || e.changed === true );
    var result = ( visibleEntries.size === 0 || visibleEntries.has( e.entry ) ) && ( showChanged === false || e.changed === true );
    return result;
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

        if( _context.storagePath && !fs.existsSync( _context.storagePath ) )
        {
            fs.mkdirSync( _context.storagePath );
        }
        if( fs.existsSync( _context.storagePath ) )
        {
            storageLocation = _context.storagePath;
        }
        else
        {
            storageLocation = _context.extensionPath;
        }

        showChanged = _context.workspaceState.get( 'showChanged', false );
    }

    getChildren( node )
    {
        if( node === undefined )
        {
            var availableNodes = nodes.filter( function( node )
            {
                return node.nodes === undefined || node.nodes.length > 0;
            } );
            var visibleNodes = availableNodes.filter( isVisible );
            if( visibleNodes.length > 0 )
            {
                return visibleNodes;
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
        var treeItem = new vscode.TreeItem( node.label ); //? node.label : node.value );

        treeItem.id = node.id;

        // console.log( "creating tree item " + node.id );

        if( node.showChanged === true && node.changed !== true )
        {
            treeItem.description = treeItem.label;
            treeItem.label = "";
        }

        if( node.nodes && node.nodes.length > 0 )
        {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            if( expandedNodes[ node.id ] !== undefined )
            {
                treeItem.collapsibleState = ( expandedNodes[ node.id ] === true ) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
            }
        }

        if( node.octicon !== undefined )
        {
            treeItem.iconPath = {
                dark: node.octicon,
                light: node.octicon
            };
        }
        else if( node.icon !== undefined )
        {
            var darkIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "dark", node.icon + ".svg" ) );
            var lightIconPath = this._context.asAbsolutePath( path.join( "resources/icons", "light", node.icon + ".svg" ) );

            treeItem.iconPath = {
                dark: darkIconPath,
                light: lightIconPath
            };
        }

        if( node.hasContextMenu )
        {
            treeItem.contextValue = "showMenu";
        }

        if( node.tooltip )
        {
            treeItem.tooltip = JSON.stringify( node.tooltip, null, 2 );
        }

        treeItem.command = {
            command: "gerrit-view.select",
            title: "",
            arguments: [ node ]
        };

        return treeItem;
    }

    clear()
    {
        nodes = [];
    }

    refresh()
    {
        console.log( "provider.refresh" );
        if( visibleEntries )
        {
            console.log( JSON.stringify( Array.from( visibleEntries ) ) );
        }
        this._onDidChangeTreeData.fire();
    }

    filter( term, children )
    {
        var matcher = new RegExp( term.text, vscode.workspace.getConfiguration( 'gerrit-view' ).get( 'showFilterCaseSensitive' ) ? "" : "i" );

        if( children === undefined )
        {
            visibleEntries.clear();
            children = nodes;
        }
        children.forEach( child =>
        {
            if( child.nodes.length > 0 )
            {
                this.filter( term, child.nodes );
            }

            // var visibleNodes = child.nodes ? child.nodes.filter( isVisible ).length : 0;
            var match = matcher.test( child.value );
            // console.log( child.type.toLowerCase() + "=" + term.key.toLowerCase() + " ? " + match );
            if( child.type.toLowerCase() === term.key.toLowerCase() )
            {
                // console.log( child.type + " text:" + term.text + " == v:" + child.value );
                if( match )
                {

                    // console.log( "  " + child.entry );
                    visibleEntries.add( child.entry );
                    // console.log( "VE:" + JSON.stringify( visibleEntries ) );
                }
            }
            // child.visible = visibleNodes > 0 || ( child.type.toLowerCase() === term.key.toLowerCase() && match );
        } );

        // console.log( "---" );
        // console.log( JSON.stringify( Array.from( visibleEntries ) ) );
    }

    clearFilter( children )
    {
        visibleEntries.clear();
        // if( children === undefined )
        // {
        //     children = nodes;
        // }
        // children.forEach( function( child )
        // {
        //     child.visible = true;
        //     if( child.nodes !== undefined )
        //     {
        //         this.clearFilter( child.nodes );
        //     }
        // }, this );
    }

    populate( data, icons, formatters, keyField )
    {
        var locateNode = function( node )
        {
            // console.log( " " + node.type + "=" + this.type + " ? " + ( node.type === this.type ) + " " + node.value + "=" + this.value + " ? " + ( node.value === this.value ) );
            return node.type === this.type && node.value === this.value;
        };

        var changed = [];
        var firstRun = Object.keys( hashes ).length === 0;

        forEach( function( node ) { node.delete = true; }, nodes );

        data.map( function( item, index )
        {
            var entry = item.details;
            var parent;
            var parents = nodes;
            var hasChanged = false;

            var key;

            if( keyField !== undefined )
            {
                key = objectUtils.getUniqueProperty( entry, keyField );

                if( key !== undefined )
                {
                    var newHash = hash( JSON.stringify( entry ) );
                    if( hashes[ key ] != newHash )
                    {
                        if( firstRun === false )
                        {
                            changed.push( key );
                            hasChanged = true;
                        }
                    }
                    hashes[ key ] = newHash;
                }
            }

            for( var level = 0; level < this._structure.length; ++level )
            {
                var children = this._structure[ level ].children;
                children.map( function( child )
                {
                    keys.add( child.property );

                    var values = objectUtils.getProperties( entry, child.property );

                    values.map( function( v )
                    {
                        var node;

                        if( level > 0 )
                        {
                            parent = parents.find( locateNode, {
                                type: this._structure[ level ].parent,
                                value: objectUtils.getUniqueProperty( entry, this._structure[ level ].parent )
                            } );
                        }

                        if( parent !== undefined )
                        {
                            node = parent.nodes.find( locateNode, { type: child.property, value: v.value } );
                        }
                        else
                        {
                            node = nodes.find( locateNode, { type: child.property, value: v.value } );
                        }

                        if( node === undefined )
                        {
                            node = {
                                entry: key,
                                level: level,
                                value: v.value,
                                label: v.value,
                                type: child.property,
                                id: child.property + ":" + ( parent ? ( parent.id + "." + v.value ) : v.value ),
                                // visible: true,
                                nodes: [],
                                changed: true
                            };

                            // console.log( "new node:" + node.id + "(type:" + child.property + ")" );

                            if( child.tooltip )
                            {
                                node.tooltip = objectUtils.getUniqueProperty( entry, child.tooltip );
                            }

                            if( child.hasContextMenu )
                            {
                                node.hasContextMenu = true;
                                // node.entry = entry;
                            }

                            if( child.showChanged )
                            {
                                node.key = key;
                                node.showChanged = true;
                                node.changed = ( firstRun === false );
                            }

                            if( child.formatter !== undefined )
                            {
                                if( formatters[ child.formatter ] !== undefined )
                                {
                                    node.label = formatters[ child.formatter ]( entry, v );
                                }
                            }

                            if( child.format !== undefined )
                            {
                                var label = child.format;
                                var regex = new RegExp( "\\$\\{(.*?)\\}", "g" );
                                label = label.replace( regex, function( match, name )
                                {
                                    return objectUtils.getUniqueProperty( entry, name, v.indexes );
                                } );
                                node.label = label;
                            }

                            if( child.icon )
                            {
                                if( octicons[ child.icon ] )
                                {
                                    var colour = new vscode.ThemeColor( "foreground" );
                                    var octiconIconPath = path.join( storageLocation, child.icon + ".svg" );

                                    if( !fs.existsSync( octiconIconPath ) )
                                    {
                                        var octiconIconDefinition = "<?xml version=\"1.0\" encoding=\"iso-8859-1\"?>\n" +
                                            octicons[ child.icon ].toSVG( { "xmlns": "http://www.w3.org/2000/svg", "fill": "#C5C5C5", "viewBox": "0 -1 10 18" } );

                                        fs.writeFileSync( octiconIconPath, octiconIconDefinition );
                                    }

                                    node.octicon = octiconIconPath;
                                }

                                else if( icons[ child.icon ] !== undefined )
                                {
                                    node.icon = icons[ child.icon ]( entry, v );
                                }
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
                            if( hasChanged )
                            {
                                node.changed = true;
                            }
                            node.delete = false;
                        }
                    }, this );
                }, this );
                if( level > 0 && parent !== undefined )
                {
                    parents = parent.nodes;
                }
            }
        }, this );

        this.prune();

        return changed;
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

    setExpanded( id, expanded )
    {
        expandedNodes[ id ] = expanded;
        this._context.workspaceState.update( 'expandedNodes', expandedNodes );
    }

    clearExpansionState()
    {
        expandedNodes = {};
        this._context.workspaceState.update( 'expandedNodes', expandedNodes );
    }

    showAll()
    {
        showChanged = false;
        this.refresh();
    }

    showChanged()
    {
        showChanged = true;
        this.refresh();
    }

    getKeys()
    {
        return keys;
    }
}

exports.TreeNodeProvider = TreeNodeProvider;
