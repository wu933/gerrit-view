/* jshint esversion:6 */

var vscode = require( 'vscode' );

var nodes = [];

var isVisible = function( e )
{
    return e.visible === true;
};

class TreeNodeProvider
{
    constructor( _context )
    {
        this._context = _context;

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

        if( node.fsPath )
        {
            treeItem.node = node;
            if( config.showBadges() && !node.tag )
            {
                treeItem.resourceUri = new vscode.Uri.file( node.fsPath );
            }

            treeItem.tooltip = node.fsPath;
            if( node.line !== undefined )
            {
                treeItem.tooltip += ", line " + ( node.line + 1 );
                if( config.shouldShowLineNumbers() )
                {
                    treeItem.label = "Line " + ( node.line + 1 ) + ":" + treeItem.label;
                }
            }

            if( node.type === PATH )
            {
                if( expandedNodes[ node.fsPath ] !== undefined )
                {
                    treeItem.collapsibleState = ( expandedNodes[ node.fsPath ] === true ) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
                }
                else
                {
                    treeItem.collapsibleState = config.shouldExpand() ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
                }

                if( node.isWorkspaceNode || node.tag )
                {
                    treeItem.iconPath = icons.getIcon( this._context, node.tag ? node.tag : node.label );
                }
                else if( node.nodes && node.nodes.length > 0 )
                {
                    treeItem.iconPath = vscode.ThemeIcon.Folder;
                }
                else
                {
                    treeItem.iconPath = vscode.ThemeIcon.File;
                }
            }
            else if( node.type === TODO )
            {
                treeItem.iconPath = icons.getIcon( this._context, node.tag ? node.tag : node.label );
                var format = config.labelFormat();
                if( format !== "" )
                {
                    treeItem.label = utils.formatLabel( format, node ) + ( node.pathLabel ? ( " " + node.pathLabel ) : "" );
                }

                treeItem.command = {
                    command: "todo-tree.revealTodo",
                    title: "",
                    arguments: [
                        node.fsPath,
                        node.line
                    ]
                };
            }
        }

        if( config.shouldShowCounts() && node.type === PATH )
        {
            var tagCounts = {};
            countTags( node, tagCounts );
            var total = Object.values( tagCounts ).reduce( function( a, b ) { return a + b; }, 0 );
            treeItem.description = total.toString();
        }

        return treeItem;
    }

    clear( folders )
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
            if( child.type === TODO )
            {
                var match = matcher.test( child.label );
                child.visible = !text || match;
            }
            else
            {
                if( child.nodes !== undefined )
                {
                    this.filter( text, child.nodes );
                }
                if( child.todos !== undefined )
                {
                    this.filter( text, child.todos );
                }
                var visibleNodes = child.nodes ? child.nodes.filter( isVisible ).length : 0;
                var visibleTodos = child.todos ? child.todos.filter( isVisible ).length : 0;
                child.visible = visibleNodes + visibleTodos > 0;
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
            if( child.todos !== undefined )
            {
                this.clearFilter( child.todos );
            }
        }, this );
    }

    populate( data )
    {
        data.map
        // var rootNode = locateWorkspaceNode( nodes, result.file );
        // var todoNode = createTodoNode( result );

        // var childNode;
        // if( config.shouldShowTagsOnly() )
        // {
        //     if( config.shouldGroup() )
        //     {
        //         if( todoNode.tag )
        //         {
        //             childNode = nodes.find( findTagNode, todoNode.tag );
        //             if( childNode === undefined )
        //             {
        //                 childNode = createTagNode( result.file, todoNode.tag );
        //                 nodes.push( childNode );
        //             }
        //         }
        //         else if( nodes.find( findTodoNode, todoNode ) === undefined )
        //         {
        //             nodes.push( todoNode );
        //         }
        //     }
        //     else
        //     {
        //         if( nodes.find( findTodoNode, todoNode ) === undefined )
        //         {
        //             nodes.push( todoNode );
        //         }
        //     }
        // }
        // else if( config.shouldFlatten() || rootNode === undefined )
        // {
        //     childNode = locateFlatChildNode( rootNode, result, todoNode.tag );
        // }
        // else if( rootNode )
        // {
        //     var relativePath = path.relative( rootNode.fsPath, result.file );
        //     var pathElements = [];
        //     if( relativePath !== "" )
        //     {
        //         pathElements = relativePath.split( path.sep );
        //     }
        //     childNode = locateTreeChildNode( rootNode, pathElements, todoNode.tag );
        // }

        // if( childNode )
        // {
        //     if( childNode.todos === undefined )
        //     {
        //         childNode.todos = [];
        //     }

        //     childNode.expanded = result.expanded;

        //     if( childNode.todos.find( findTodoNode, todoNode ) === undefined )
        //     {
        //         todoNode.parent = childNode;
        //         childNode.todos.push( todoNode );
        //         childNode.showCount = true;
        //     }
        // }
    }


    // getElement( filename, found, children )
    // {
    //     if( children === undefined )
    //     {
    //         children = nodes;
    //     }
    //     children.forEach( function( child )
    //     {
    //         if( child.fsPath === filename )
    //         {
    //             found( child );
    //         }
    //         else if( child.nodes !== undefined )
    //         {
    //             return this.getElement( filename, found, child.nodes );
    //         }
    //     }, this );
    // }
}

exports.TreeNodeProvider = TreeNodeProvider;
