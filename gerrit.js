var child_process = require( 'child_process' );
var fs = require( 'fs' )
var nodeSsh = require( 'node-ssh' );
var os = require( 'os' );
var path = require( 'path' );

var currentProcess;

function GerritError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

function formatResults( stdout, debug )
{
    if( !stdout )
    {
        return [];
    }

    stdout = stdout.trim();

    var results = [];

    try
    {
        results = stdout
            .split( '\n' )
            .map( ( line ) => new Entry( line ) );
    }
    catch( e )
    {
        debug( e );
    }

    return results;
}

module.exports.run = function run( query, options )
{
    function debug( text )
    {
        if( options && options.outputChannel )
        {
            options.outputChannel.appendLine( text );
        }
    }

    var ssh = new nodeSsh();

    return new Promise( function( resolve, reject )
    {
        ssh.connect( {
            host: query.server,
            username: os.userInfo().username,
            port: query.port,
            privateKey: path.join( os.homedir(), ".ssh", "id_rsa" )
        } ).then( function()
        {
            ssh.execCommand( [ query.command, query.query, query.options, "--format JSON" ].join( " " ) ).then( function( result )
            {
                resolve( formatResults( result.stdout, debug ) );
            } )
        }, function( error )
            {
                reject( new GerritError( error, "" ) );
            }
        );
    } );

    // var query = "ssh -p " + config.get( "port" ) + " " + config.get( "server" ) + " gerrit query " + config.get( "query" ) + " " + config.get( "options" ) + " --format JSON";


    // var execString = command;

    // debug( execString );

    // return new Promise( function( resolve, reject )
    // {

    //     const maxBuffer = ( options.maxBuffer || 200 ) * 1024;
    //     var currentProcess = child_process.exec( execString, { maxBuffer } );

    //     var results = "";

    //     currentProcess.stdout.on( 'data', function( data )
    //     {
    //         results += data;
    //     } );

    //     currentProcess.stderr.on( 'data', function( data )
    //     {
    //         reject( new GerritError( data, "" ) );
    //     } );

    //     currentProcess.on( 'close', function( code )
    //     {
    //         if( code === 0 )
    //         {
    //             resolve( formatResults( results, debug ) );
    //         }
    //         else
    //         {
    //             reject( new GerritError( "Too many results - try using the 'limit:<n>' option, or increasing 'gerrit-view.bufferSize'.", "" ) );
    //         }
    //     } );
    //     fs.readFile( '/Users/nige/Projects/vscode-extensions/gerrit-view/gerrit.json', 'utf8', function( err, data )
    //     {
    //         resolve( formatResults( data, debug ) );
    //     } );
    // } );
};

module.exports.kill = function()
{
    if( currentProcess !== undefined )
    {
        currentProcess.kill( 'SIGINT' );
    }
};

class Entry
{
    constructor( text )
    {
        this.details = JSON.parse( text );
    }
}

module.exports.Entry = Entry;
