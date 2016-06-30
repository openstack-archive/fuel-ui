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

no_nailgun_start=${NO_NAILGUN_START:-0}
test_prefix=${TEST_PREFIX:-"test_*"}
conf_path=${CONF_PATH:-static/tests/component_registry/plugin_conf}

FUEL_WEB_ROOT=$(readlink -f ${FUEL_WEB_ROOT:-$(dirname $0)/../fuel-web})
NAILGUN_ROOT=$FUEL_WEB_ROOT/nailgun

ARTIFACTS=${ARTIFACTS:-`pwd`/test_run/ui_component}
mkdir -p $ARTIFACTS

export NAILGUN_STATIC=$ARTIFACTS/static
export NAILGUN_TEMPLATES=$NAILGUN_STATIC

export NAILGUN_PORT=${NAILGUN_PORT:-5544}
export NAILGUN_START_MAX_WAIT_TIME=${NAILGUN_START_MAX_WAIT_TIME:-30}

export NAILGUN_DB_HOST=${NAILGUN_DB_HOST:-/var/run/postgresql}
export NAILGUN_DB=${NAILGUN_DB:-nailgun}
export NAILGUN_DB_USER=${NAILGUN_DB_USER:-nailgun}
export NAILGUN_DB_USERPW=${NAILGUN_DB_USERPW:-nailgun}

export DB_ROOT=${DB_ROOT:-postgres}

export NAILGUN_FIXTURE_FILES="${NAILGUN_ROOT}/nailgun/fixtures/sample_environment.json"
export NAILGUN_CHECK_URL='/api/version'


function run_ui_func_tests {
  local GULP="./node_modules/.bin/gulp"
  local TESTS_DIR=static/tests/component_registry
  local TESTS=$TESTS_DIR/${test_prefix}.js

  echo "INFO: Running ${TESTS}"

  if [ ${no_nailgun_start} -ne 1 ]; then
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

  local result=0

  export SERVER_ADDRESS=127.0.0.1
  export SERVER_PORT=${NAILGUN_PORT}
  nailgun_plugins_path='/var/www/nailgun/plugins'

  require_nsxv=('test_network_dvs_nsxv' )

  for test_case in $TESTS; do
    echo "INFO: Running test case ${test_case}"
    test_name="$(basename ${test_case} .js)"

    plugin_dvs=$(sudo alien -i ${DVS_PLUGIN_PATH:-"../dvs_plugin.rpm"} | grep -oP 'Setting up \K[^ ]*')
    [[ ${test_name} =~ ${require_nsxv} ]] && \
      second_plugin=$(sudo alien -i ${NSX_PLUGIN_PATH:-"../nsx_plugin.rpm"} | grep -oP 'Setting up \K[^ ]*') || \
        second_plugin=$(sudo alien -i ${CONTRAIL_PLUGIN_PATH:-"../contail_plugin.rpm"} | grep -oP 'Setting up \K[^ ]*')

    for plugin in ${plugin_dvs} ${second_plugin}; do
      plugin_name=$(grep -oP '^name: \K(.*)' ${nailgun_plugins_path}/${plugin}/metadata.yaml)
      plugin_version=$(grep -oP '^version: \K(.*)' ${nailgun_plugins_path}/${plugin}/metadata.yaml)

      fuel --os-username admin --os-password admin plugins --register ${plugin_name}==${plugin_version//\'/}

      [ -f ${conf_path}/${plugin_name}*/${test_name}.yaml ] && \
      sudo cp ${conf_path}/${plugin_name}*/${test_name}.yaml ${nailgun_plugins_path}/${plugin}/components.yaml
    done

    fuel --os-username admin --os-password admin plugins --sync

    ARTIFACTS=$ARTIFACTS \
    ${GULP} functional-tests --suites=${test_case} || result=1

    for plugin in ${plugin_dvs} ${second_plugin}; do
      plugin_name=$(grep -oP '^name: \K(.*)' ${nailgun_plugins_path}/${plugin}/metadata.yaml)
      plugin_version=$(grep -oP '^version: \K(.*)' ${nailgun_plugins_path}/${plugin}/metadata.yaml)

      fuel --os-username admin --os-password admin plugins --remove ${plugin_name}==${plugin_version//\'/} 2>/dev/null || \
        echo "${plugin_name} was removed"
    done

    if [ $result -ne 0 ]; then
      break
    fi

  done

  if [ ${no_nailgun_start} -ne 1 ]; then
    pushd "$FUEL_WEB_ROOT" > /dev/null
    tox -e stop
    popd > /dev/null
  fi

  return $result
}

run_ui_func_tests
