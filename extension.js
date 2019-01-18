/* jshint esversion:6 */

var vscode = require( 'vscode' );
var gerrit = require( './gerrit.js' );

var tree = require( "./tree.js" );

function activate( context )
{
    var structure = [
        {
            children: [ { property: "project" } ]
        },
        {
            parent: "project",
            children: [ { property: "branch", format: "branch: ${branch}" } ],
        },
        {
            parent: "branch",
            children: [ { property: "status" } ]
        },
        {
            parent: "status",
            children: [ { property: "subject" } ]
        },
        {
            parent: "subject",
            children: [ { property: "number" }, { property: "owner.username" } ],
        },
        {
            parent: "owner.username",
            children: [ { property: "owner.name" }, { property: "owner.email" } ],
        }
    ];

    var provider = new tree.TreeNodeProvider( context, structure );

    var gerritView = vscode.window.createTreeView( "gerrit-view", { treeDataProvider: provider, showCollapseAll: true } );

    var outputChannel;

    context.subscriptions.push( provider );
    context.subscriptions.push( gerritView );

    function resetOutputChannel()
    {
        if( outputChannel )
        {
            outputChannel.dispose();
            outputChannel = undefined;
        }
        if( vscode.workspace.getConfiguration( 'gerrit-view' ).debug === true )
        {
            outputChannel = vscode.window.createOutputChannel( "Gerrit View" );
        }
    }

    function debug( text )
    {
        if( outputChannel )
        {
            outputChannel.appendLine( text );
        }
    }

    function setContext()
    {
        vscode.commands.executeCommand( 'setContext', 'gerrit-view-filtered', context.workspaceState.get( 'filtered', false ) );
    }

    function refresh()
    {
        provider.refresh();
        setContext();
    }

    function clearFilter()
    {
        currentFilter = undefined;
        context.workspaceState.update( 'filtered', false );
        provider.clearFilter();
        refresh();
    }

    function getGerritData()
    {
        var icons = {};
        icons.score = function( entry )
        {
            var name;
            var built = false;
            var finished = false;
            var score = 0;

            if( entry.currentPatchSet && entry.currentPatchSet.approvals !== undefined )
            {
                entry.currentPatchSet.approvals.map( function( approval )
                {
                    if( finished === false )
                    {
                        var approvalScore = parseInt( approval.value );

                        if( approval.type === "Verified" )
                        {
                            built = true;
                            if( approvalScore === -1 )
                            {
                                name = "failed";
                                finished = true;
                            }
                            else if( approvalScore === 1 )
                            {
                                name = "verified";
                            }
                        }
                        if( approval.type === "Code-Review" )
                        {
                            if( approvalScore === -2 )
                            {
                                name = "minus-two";
                                finished = true;
                            }
                            else if( approvalScore === -1 && score < 2 )
                            {
                                score = approvalScore;
                            }
                            else if( approvalScore > 0 )
                            {
                                score = approvalScore;
                            }
                        }
                    }
                } );
            }

            if( built === false )
            {
                name = "building";
            }
            else
            {
                switch( score )
                {
                    case 2: name = "plus-two"; break;
                    case 1: name = "plus-one"; break;
                    case -1: name = "minus-one"; break;
                }
            }

            return name;
        };

        // provider.clear();

        var config = vscode.workspace.getConfiguration( 'gerrit-view' );
        var query = "ssh -p " + config.get( "port" ) + " " + config.get( "server" ) + " gerrit query " + config.get( "query" ) + " " + config.get( "options" ) + " --format JSON";

        gerrit.query( query, { outputChannel: outputChannel, maxBuffer: config.get( "queryBufferSize" ) } ).then( function( results )
        {
            if( results.length > 0 )
            {
                // results = results.slice( 0, 1 );
                results.forEach( result =>
                {
                    debug( "entry: " + JSON.stringify( result, null, 2 ) );
                } );
                provider.populate( results, icons );
                refresh();
            }
            else
            {
                vscode.window.showInformationMessage( "gerrit-view: No results found" );
            }
        } ).catch( function( e )
        {
            var message = e.message;
            if( e.stderr )
            {
                message += " (" + e.stderr + ")";
            }
            vscode.window.showErrorMessage( "gerrit-view: " + message );
        } );
    }

    function register()
    {
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.filter', function()
        {
            vscode.window.showInputBox( { prompt: "Filter tree" } ).then(
                function( term )
                {
                    currentFilter = term;
                    if( currentFilter )
                    {
                        context.workspaceState.update( 'filtered', true );
                        provider.filter( currentFilter );
                        refresh();
                    }
                } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.filterClear', clearFilter ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.refresh', getGerritData ) );

        context.subscriptions.push( gerritView.onDidExpandElement( function( e ) { provider.setExpanded( e.element.id, true ); } ) );
        context.subscriptions.push( gerritView.onDidCollapseElement( function( e ) { provider.setExpanded( e.element.id, false ); } ) );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( "gerrit-view" ) )
            {
                if( e.affectsConfiguration( "gerrit-view.debug" ) )
                {
                    resetOutputChannel();
                }
                else
                {
                    getGerritData();
                }

                vscode.commands.executeCommand( 'setContext', 'gerrit-view-in-explorer', vscode.workspace.getConfiguration( 'gerrit-view' ).showInExplorer );
                setContext();
            }
        } ) );

        context.subscriptions.push( outputChannel );

        vscode.commands.executeCommand( 'setContext', 'gerrit-view-in-explorer', vscode.workspace.getConfiguration( 'gerrit-view' ).showInExplorer );

        resetOutputChannel();

        setContext();

        getGerritData();
    }

    register();
}

function deactivate()
{
    provider.clear( [] );
}

exports.activate = activate;
exports.deactivate = deactivate;
