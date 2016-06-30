#!/bin/bash

#    Copyright 2016 Mirantis, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

set -eu

# Variables for tests
export NO_NAILGUN_START=${NO_NAILGUN_START:-0}
export TEST_PREFIX=${TEST_PREFIX:-"test_*"}
export FUEL_WEB_ROOT=$(readlink -f ${FUEL_WEB_ROOT:-$(dirname $0)/../fuel-web})
export ARTIFACTS=${ARTIFACTS:-`pwd`/test_run/ui_component}
export PLUGIN_RPM=${PLUGIN_RPM:-"${CONF_PATH}/plugin.rpm"}

# Variables for nailgun
export NAILGUN_PORT=${NAILGUN_PORT:-5544}
export NAILGUN_START_MAX_WAIT_TIME=${NAILGUN_START_MAX_WAIT_TIME:-30}
export NAILGUN_DB_HOST=${NAILGUN_DB_HOST:-/var/run/postgresql}
export NAILGUN_DB=${NAILGUN_DB:-nailgun}
export NAILGUN_DB_USER=${NAILGUN_DB_USER:-nailgun}
export NAILGUN_DB_USERPW=${NAILGUN_DB_USERPW:-nailgun}
export DB_ROOT=${DB_ROOT:-postgres}

if [ -z ${CONF_PATH:-} ]; then
  export CONF_PATH=$(pwd)/'static/tests/functional/component_registry/plugin_conf'
fi
export SCRIPT_PATH=${CONF_PATH}/update_components.sh

mkdir -p $ARTIFACTS

NAILGUN_ROOT=$FUEL_WEB_ROOT/nailgun
export NAILGUN_STATIC=$ARTIFACTS/static
export NAILGUN_TEMPLATES=$NAILGUN_STATIC
export NAILGUN_CHECK_URL='/api/version'


function install_plugin {
  plugin_rpm=$1

  local plugin_dir=$(sudo alien -i ${plugin_rpm} | grep -oP 'Setting up \K[^ ]*')
  export PLUGIN_PATH=$(echo ${nailgun_plugins_path}/${plugin_dir//[-_]/\*})

  meta=${PLUGIN_PATH}/metadata.yaml
  plugin_name=$(grep -oP '^name: \K(.*)' ${meta})
  plugin_version=$(grep -oP '^version: \K(.*)' ${meta})

  sudo sed -i -e "s/fuel_version: \['8.0'\]/fuel_version: \['9.0'\]/" ${meta}

  fuel --os-username admin --os-password admin plugins \
    --register ${plugin_name}==${plugin_version//\'/}
}

function remove_plugin {
  fuel --os-username admin --os-password admin plugins \
    --remove ${plugin_name}==${plugin_version//\'/} 2>/dev/null || \
    echo "${plugin_name} was removed"
}

function run_ui_func_tests {
  local GULP="./node_modules/.bin/gulp"
  local TESTS_DIR='static/tests/functional/component_registry'
  local TESTS=$TESTS_DIR/${TEST_PREFIX}.js
  local result=0

  export SERVER_ADDRESS=127.0.0.1
  export SERVER_PORT=${NAILGUN_PORT}
  nailgun_plugins_path='/var/www/nailgun/plugins'

  pip install python-fuelclient
  fuelclient="${VENV}/lib/python2.7/site-packages/fuelclient"
  sudo sed -i -e "s/if self.auth_required/if True/" ${fuelclient}/client.py

  if [ ${NO_NAILGUN_START} -ne 1 ]; then
      pushd "$FUEL_WEB_ROOT" > /dev/null
      tox -e cleanup
      tox -e stop
      tox -e cleanup
      tox -e start
      popd > /dev/null
  fi

  ${GULP} build --no-sourcemaps --extra-entries=sinon --static-dir=$NAILGUN_STATIC
  if [ $? -ne 0 ]; then
    return 1
  fi

  install_plugin ${PLUGIN_RPM:-"${CONF_PATH}/plugin.rpm"}

  for test_case in $TESTS; do
    echo "INFO: Running test case ${test_case}"
    test_name="$(basename ${test_case} .js)"

    ARTIFACTS=$ARTIFACTS \
    ${GULP} functional-tests --suites=${test_case} || result=1

    if [ $result -ne 0 ]; then
      break
    fi
  done

  remove_plugin

  if [ ${NO_NAILGUN_START} -ne 1 ]; then
    pushd "$FUEL_WEB_ROOT" > /dev/null
    tox -e stop
    popd > /dev/null
  fi

  return $result
}

run_ui_func_tests
