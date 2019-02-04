# Gerrit View

This extension provides a view of your Gerrit server, either in the explorer view and/or in the SCM view. When parts of the tree are updated they are displayed larger and brighter.

## Controls

The view title bar contains the following buttons:

<img src="resources/icons/light/tick.svg" height="16px"> clears all changed items<br>
<img src="resources/icons/light/star.svg" height="16px"/> show only changed items (click items to remove from the view)<br>
<img src="resources/icons/light/empty-star.svg" height="16px"/> show all items<br>
<img src="resources/icons/light/filter.svg" height="16px"> filter the view based on the contents of one of the fields<br>
<img src="resources/icons/light/clear-filter.svg" height="16px"> clear the current filter<br>
<img src="resources/icons/light/refresh.svg" height="16px"> refresh the view<br>
<img src="resources/icons/light/collapse.svg" height="16px"> refresh the view<br>


## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.gerrit-view).

Alternatively, open Visual Studio code, press `Ctrl+P` or `Cmd+P` and type:

    > ext install gerrit-view

*Note: Don't forget to reload the window to activate the extension!*

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/gerrit-view).

## Commands

The default query is `status:open` which will return open changesets from all probjects and branches. To modify the query, use the `Gerrit View: Set Query` command.

## Configuration

| Setting                         | Default               | Description                                                                           |
|---------------------------------|-----------------------|---------------------------------------------------------------------------------------|
| gerrit-view.server              |                       | Your Gerrit server hostname.|                                                         |
| gerrit-view.port                | 29418                 | Port number for your Gerrit server.                                                   |
| gerrit-view.pathToSshKey        | ".ssh/id_rsa"         | Path to your ssh key.                                                                 |
| gerrit-view.queryBufferSize     | 200                   | Size of query buffer in kilobytes. Increase this if you expect lots of query results. |
| gerrit-view.options             | "--current-patch-set" | Query options.                                                                        |
| gerrit-view.query               | "status:open"         | Query for retrieving data.                                                            |
| gerrit-view.debug               | false                 | Create a debug channel in the Output view.                                            |
| gerrit-view.showInExplorer      | true                  | Show the tree in the explorer view.                                                   |
| gerrit-view.filterCaseSensitive | false                 | Set to true if you want the view filtering to be case sensitive.                      |
| gerrit-view.autoRefresh         | 60                    | Automatically refresh the tree after this many seconds. Set to 0 to disable.          |

## Donate

If you find this extension useful, please feel free to donate <a href="https://paypal.me/Gruntfuggly">here</a>. Thanks!

### Credits

Icon from wikipedia - attribution: By Original uploader was Leucosticte at MediaWiki - Transferred from MediaWiki, Public Domain, https://commons.wikimedia.org/w/index.php?curid=27361356

Building icon made by <a href="https://www.flaticon.com/authors/bogdan-rosu" title="Bogdan Rosu">Bogdan Rosu</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Score icons license: Apache 2.0

Verfied/Failed icons license: http://creativecommons.org/licenses/by-sa/3.0/

Empty star icon made by <a href="https://www.flaticon.com/authors/gregor-cresnar" title="Gregor Cresnar">Gregor Cresnar</a> from <a href="https://www.flaticon.com/"                title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>

Closed star icon made by <a href="https://www.flaticon.com/authors/revicon" title="Revicon">Revicon</a> from <a href="https://www.flaticon.com/"                title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/"title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a>