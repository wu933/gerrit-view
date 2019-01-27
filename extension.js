/* jshint esversion:6 */

var vscode = require( 'vscode' );
var gerrit = require( './gerrit.js' );
var tree = require( "./tree.js" );
var objectUtils = require( "./objectUtils.js" );

var autoRefresh;

function toString( date )
{
    return Intl.DateTimeFormat(
        'en-GB',
        { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    ).format( date );
}

function activate( context )
{
    var structure = [
        {
            children: [
                { property: "project", icon: "briefcase" }
            ]
        },
        {
            parent: "project",
            children: [
                { property: "branch", format: "branch: ${branch}", icon: "git-branch" }
            ]
        },
        {
            parent: "branch",
            children: [
                { property: "status" }
            ]
        },
        {
            parent: "status",
            children: [
                { property: "subject", icon: "overallScore", showChanged: true, format: "${number} ${subject}", hasContextMenu: true, tooltip: "currentPatchSet.approvals" }
            ]
        },
        {
            parent: "subject",
            children: [
                { property: "currentPatchSet.approvals.by.name", icon: "score" },
                { property: "id", format: "ID: ${id}" },
                { property: "createdOn", formatter: "created" },
                { property: "lastUpdated", formatter: "updated" },
                { property: "owner.name", format: "Owner: ${owner.name} (${owner.username})" }
            ],
        },
        {
            parent: "owner.name",
            children: [
                { property: "owner.email" }
            ],
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
        vscode.commands.executeCommand( 'setContext', 'gerrit-view-show-changed', context.workspaceState.get( 'showChanged', false ) );
    }

    function refresh()
    {
        console.log( "refresh" );
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

    function getGerritData( refreshRequired )
    {
        var icons = {};
        icons.overallScore = function( entry )
        {
            var name;
            var built = false;
            var finished = false;
            var score = 0;

            if( entry.currentPatchSet && entry.currentPatchSet.approvals !== undefined )
            {
                entry.currentPatchSet.approvals.map( function( approval )
                {
                    if( approval.type === "Verified" )
                    {
                        built = true;
                    }

                    if( finished === false )
                    {
                        var approvalScore = parseInt( approval.value );

                        if( approval.type === "Verified" )
                        {
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

            console.log( entry.number + " built:" + built + " score:" + score );

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

        icons.score = function( entry, property )
        {
            var value = parseInt( objectUtils.getUniqueProperty( entry, "currentPatchSet.approvals.value", property.indexes ) );
            var name;

            switch( value )
            {
                case -2: name = "minus-two"; break;
                case -1: name = "minus-one"; break;
                case 1: name = "plus-one"; break;
                case 2: name = "plus-two"; break;
            }

            return name;
        };

        formatters = {};
        formatters.created = function( entry )
        {
            var date = new Date( 0 );
            date.setUTCSeconds( parseInt( entry.createdOn ) );
            return "Created: " + toString( date );
        };
        formatters.updated = function( entry )
        {
            var date = new Date( 0 );
            date.setUTCSeconds( parseInt( entry.lastUpdated ) );
            return "Updated: " + toString( date );
        };

        if( vscode.window.state.focused !== true )
        {
            return;
        }

        var config = vscode.workspace.getConfiguration( 'gerrit-view' );
        var query = "ssh -p " + config.get( "port" ) + " " + config.get( "server" ) + " gerrit query " + config.get( "query" ) + " " + config.get( "options" ) + " --format JSON";

        console.log( "Running gerrit query: " + query );
        gerrit.query( query, { outputChannel: outputChannel, maxBuffer: config.get( "queryBufferSize" ) } ).then( function( results )
        {
            // results = [ results[ 0 ] ];
            console.log( "results:" + results.length );
            if( results.length > 0 )
            {
                var changed = provider.populate( results, icons, formatters, "number" );

                console.log( "changed:" + changed.length );
                if( changed.length > 0 )
                {
                    vscode.window.showInformationMessage( "gerrit-view: Updated change sets: " + changed.join( "," ) );
                }

                console.log( "refreshRequired:" + refreshRequired );
                if( refreshRequired !== false )
                {
                    refresh();
                }
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

        debug( "Last update: " + new Date().toISOString() );
    }

    function setAutoRefresh()
    {
        var interval = parseInt( vscode.workspace.getConfiguration( 'gerrit-view' ).get( 'autoRefresh' ) );

        clearInterval( autoRefresh );

        if( !isNaN( interval ) && interval > 0 )
        {
            autoRefresh = setInterval( getGerritData, interval * 1000 );
        }
    }

    function showChanged()
    {
        context.workspaceState.update( 'showChanged', true );
        provider.showChanged();
        setContext();
    }

    function showAll()
    {
        context.workspaceState.update( 'showChanged', false );
        provider.showAll();
        setContext();
    }

    function register()
    {
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.filter', function()
        {
            var keys = Array.from( provider.getKeys() );
            vscode.window.showQuickPick( keys, { matchOnDetail: true, matchOnDescription: true, canPickMany: false, placeHolder: "Select key to filter on" } ).then( function( key )
            {
                vscode.window.showInputBox( { prompt: "Enter value to filer '" + key + "' on:" } ).then(
                    function( term )
                    {
                        currentFilter = term;
                        if( currentFilter )
                        {
                            context.workspaceState.update( 'filtered', true );
                            provider.filter( { key: key, text: currentFilter } );
                            refresh();
                        }
                    } );
            } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.select', ( node ) =>
        {
            node.changed = false;
            provider.refresh();
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.filterClear', clearFilter ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.refresh', getGerritData ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.openInBrowser', function( item )
        {
            vscode.commands.executeCommand( 'vscode.open', vscode.Uri.parse( item.entry.url ) );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.showChanged', showChanged ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.showAll', showAll ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'gerrit-view.setQuery', function()
        {
            var currentQuery = vscode.workspace.getConfiguration( 'gerrit-view' ).get( 'query' );
            vscode.window.showInputBox( { prompt: "Gerrit Query", placeholder: "e.g. status:open", value: currentQuery } ).then( function( query )
            {
                if( query )
                {
                    vscode.workspace.getConfiguration( 'gerrit-view' ).update( 'query', query, false ).then( refresh );
                }
            } );
        } ) );

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
                else if( e.affectsConfiguration( "gerrit-view.autoRefresh" ) )
                {
                    setAutoRefresh();
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

        getGerritData( false );

        setAutoRefresh();
    }

    register();
}

function deactivate()
{
    provider.clear( [] );
}

exports.activate = activate;
exports.deactivate = deactivate;
