/* jshint esversion:6 */

var vscode = require( 'vscode' );
var gerrit = require( './gerrit.js' );
var fs = require( 'fs' )

var tree = require( "./tree.js" );

function activate( context )
{
    var structure = [
        {
            children: [ "project" ]
        },
        {
            parent: "project",
            children: [ "branch" ],
        },
        {
            parent: "branch",
            children: [ "subject" ]
        },
        {
            parent: "subject",
            children: [ "number", "status", "owner.username" ],
        },
        {
            parent: "owner.username",
            children: [ "owner.name", "owner.email" ],
        }
    ];

    var provider = new tree.TreeNodeProvider( context, structure );

    var gerritViewExplorer = vscode.window.createTreeView( "gerrit-view-explorer", { treeDataProvider: provider } );
    var gerritView = vscode.window.createTreeView( "gerrit-view", { treeDataProvider: provider } );

    var outputChannel;

    context.subscriptions.push( provider );
    context.subscriptions.push( gerritViewExplorer );
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
        var extractors = {};
        extractors.subject = function( entry )
        {
            var score = 0;
            if( entry.currentPatchSet && entry.currentPatchSet.approvals !== undefined )
            {
                entry.currentPatchSet.approvals.map( function( approval )
                {
                    var approvalScore = parseInt( approval.value );
                    if( approvalScore === -2 )
                    {
                        score = -2;
                    }
                    else if( score !== -2 )
                    {
                        if( approvalScore === 2 )
                        {
                            score = 2;
                        }
                        else
                        {
                            score = Math.max( score, approvalScore );
                        }
                    }
                } );
            }
            return score + " " + entry.subject;
        };

        var config = vscode.workspace.getConfiguration( 'gerrit-view' );
        var query = "ssh -p 29418 " + config.get( "server" ) + " gerrit query " + config.get( "query" );
        gerrit.query( query ).then( function( results )
        {
            if( results.length > 0 )
            {
                results.forEach( result =>
                {
                    debug( "entry: " + JSON.stringify( result, null, 2 ) );
                } );
                provider.populate( results, extractors );
                refresh();
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
                        refreshTree();
                    }
                } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.filterClear', clearFilter ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.refresh', refresh ) );

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
                    refresh();
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
