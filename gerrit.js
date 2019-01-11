const child_process = require( 'child_process' );
// const fs = require( 'fs' );

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

module.exports.query = function query( command )
{
    let execString = command;

    // if( options.outputChannel )
    // {
    //     options.outputChannel.appendLine( "Command: " + execString );
    // }

    return new Promise( function( resolve, reject )
    {
        // The default for omitting maxBuffer, according to Node docs, is 200kB.
        // We'll explicitly give that here if a custom value is not provided.
        // Note that our options value is in KB, so we have to convert to bytes.
        const maxBuffer = 200 * 1024;
        var currentProcess = child_process.exec( execString );
        var results = "";

        currentProcess.stdout.on( 'data', function( data )
        {
            // if( options.outputChannel )
            // {
            //     options.outputChannel.appendLine( data );
            // }
            results += data;
        } );

        currentProcess.stderr.on( 'data', function( data )
        {
            // if( options.outputChannel )
            // {
            //     options.outputChannel.appendLine( data );
            // }
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
        this.result = JSON.parse( text );
    }
}

module.exports.Entry = Entry;
