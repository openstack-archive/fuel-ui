FUEL UI
=======

This repository contains Fuel UI - the web user interface for Nailgun.

Installation
------------

* Fuel UI requires Node.js 0.10+ to be installed on your system. On Ubuntu
  14.04 you can install it using the following commands::

    sudo apt-get remove --yes nodejs nodejs-legacy
    sudo add-apt-repository --yes ppa:chris-lea/node.js
    sudo apt-get update
    sudo apt-get install --yes nodejs
    sudo chown -R `whoami`.`whoami` ~/.npm

* Install JS dependencies and Gulp::

    npm install
    sudo npm install -g gulp

* The most convenient approach to modify Fuel UI is to use a development
  server. It watches for file changes and automatically rebuilds changed
  modules (significantly faster than full rebuild) and triggers page refresh
  in browsers::

    gulp dev-server

  By default it runs on port 8080 and assumes that Nailgun runs on
  port 8000. You can override this by using the following options::

    gulp dev-server --dev-server-host=127.0.0.1 --dev-server-port=8080 --nailgun-host=127.0.0.1 --nailgun-port=8000

  If automatic rebuild on change doesn't work, most likely you need to
  increase the limit of inotify watches::

    echo 100000 | sudo tee /proc/sys/fs/inotify/max_user_watches

* The production version of Fuel UI can be built by running::

    gulp build

  To specify custom output directory location, use `static-dir` option::

    gulp build --static-dir=static_compressed

  To speed up build process you may also want to disable uglification and
  source maps generation::

    gulp build --no-uglify --no-sourcemaps

  If for some reason you don't want to use a development server, but would
  like to recompile the bundle on any change, use::

    gulp build --watch

Testing
-------

* UI tests use Selenium server, so you need to install Java Runtime
  Environment (JRE) 1.7 or newer version.

* You also need to install Firefox - it is used as the default browser for
  tests.

* Run full Web UI test suite, run::

    npm run lint
    npm test

  UI functional tests require Nailgun server from fuel-web repo to be
  installed. By default it's assumed that fuel-web repo is in the same
  directory as fuel-ui repo, but you can specify another path using
  FUEL_WEB_ROOT environment variable::

    FUEL_WEB_ROOT=/path/to/fuel-web npm test

  By default Firefox browser is used. You can specify the browser using
  BROWSER environment variable::

    BROWSER=chrome npm test
