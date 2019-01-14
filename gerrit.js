var child_process = require( 'child_process' );

var currentProcess;

function GerritError( error, stderr )
{
    this.message = error;
    this.stderr = stderr;
}

function formatResults( stdout )
{
    stdout = stdout.trim();

    if( !stdout )
    {
        return [];
    }

    return stdout
        .split( '\n' )
        .map( ( line ) => new Entry( line ) );
}

module.exports.query = function query( command, options )
{
    function debug( text )
    {
        if( options && options.outputChannel )
        {
            options.outputChannel.appendLine( text );
        }
    }

    var execString = command;

    debug( execString );

    return new Promise( function( resolve, reject )
    {
        var currentProcess = child_process.exec( execString );
        var results = "";

        currentProcess.stdout.on( 'data', function( data )
        {
            debug( data );
            results += data;
        } );

        currentProcess.stderr.on( 'data', function( data )
        {
            debug( data )
            reject( new GerritError( data, "" ) );
        } );

        currentProcess.on( 'close', function( code )
        {
            resolve( formatResults( results ) );
        } );

    } );
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
