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
export TESTS_ROOT="$(pwd)/static/tests/functional/alive_plugin"
export SCRIPT_PATH="${TESTS_ROOT}/update_plugin.sh"
export TEST_PREFIX=${TEST_PREFIX:-'test_*'}
export TESTS_DIR_NAME=${TESTS_DIR_NAME:-'feature_nics'}
export CONF_PATH="${TESTS_ROOT}/${TESTS_DIR_NAME}/plugin_conf"

export NO_NAILGUN_START=${NO_NAILGUN_START:-0}
export FUEL_WEB_ROOT=$(readlink -f ${FUEL_WEB_ROOT:-"$(dirname $0)/../fuel-web"})
export ARTIFACTS=${ARTIFACTS:-"$(pwd)/test_run/ui_component"}

export PLUGIN_RPM=${PLUGIN_RPM:-''}
if [ -z "${PLUGIN_RPM}" ]; then
  plugins='https://product-ci.infra.mirantis.net/view/All/job/9.0.build-fuel-plugins'
  path='lastSuccessfulBuild/artifact/built_plugins/fuel_plugin_example_v5-1.0-1.0.0-1.noarch.rpm'
  plugin_url=${PLUGIN_URL:-"${plugins}/${path}"}

  export PLUGIN_RPM="${CONF_PATH}/plugin.rpm"
  wget --no-check-certificate -O "${PLUGIN_RPM}" "${plugin_url}"
fi

# Variables for nailgun
export NAILGUN_PORT=${NAILGUN_PORT:-5544}
export NAILGUN_START_MAX_WAIT_TIME=${NAILGUN_START_MAX_WAIT_TIME:-30}
export NAILGUN_DB_HOST=${NAILGUN_DB_HOST:-/var/run/postgresql}
export NAILGUN_DB=${NAILGUN_DB:-nailgun}
export NAILGUN_DB_USER=${NAILGUN_DB_USER:-nailgun}
export NAILGUN_DB_USERPW=${NAILGUN_DB_USERPW:-nailgun}
export DB_ROOT=${DB_ROOT:-postgres}

export NAILGUN_ROOT=$FUEL_WEB_ROOT/nailgun
export NAILGUN_STATIC=$ARTIFACTS/static
export NAILGUN_TEMPLATES=$NAILGUN_STATIC
export NAILGUN_CHECK_URL='/api/version'

mkdir -p "$ARTIFACTS"

function install_prepare_plugin {
  plugin_rpm=$1

  mkdir -p "${nailgun_plugins_path}"
  local plugin_dir=$(sudo alien -i "${plugin_rpm}" | grep -oP 'Setting up \K[^ ]*')
  export PLUGIN_PATH=$(echo ${nailgun_plugins_path}/${plugin_dir//[-_]/\*})

  meta=${PLUGIN_PATH}/metadata.yaml
  plugin_name=$(grep -oP '^name: \K(.*)' "${meta}")
  plugin_version=$(grep -oP '^version: \K(.*)' "${meta}")

  # Fix versions
  sudo sed -i -e "s/fuel_version: .*/fuel_version: \['10.0'\]/" "${meta}"
  sudo sed -i -e "s/package_version: .*/package_version: '5.0.0'/" "${meta}"
  sudo sed -i -e "s/mitaka-9.0/newton-10.0/" "${meta}"  # release version

  # Fix components settings
  sudo sed -i -e "s/requires/#requires/" ${PLUGIN_PATH}/components.yaml
  sudo sed -i -e "s/incompatible/#incompatible/" ${PLUGIN_PATH}/components.yaml

  fuel --os-username admin --os-password admin plugins \
    --register "${plugin_name}==${plugin_version//\'/}"
}

function remove_plugin {
  fuel --os-username admin --os-password admin plugins \
    --remove "${plugin_name}==${plugin_version//\'/}" 2>/dev/null && \
    echo "${plugin_name} was removed" || echo "Can not remove plugin ${plugin_name}"
}

function run_component_tests {
  local GULP='./node_modules/.bin/gulp'
  local TESTS_DIR="static/tests/functional/alive_plugin/${TESTS_DIR_NAME}"
  local TESTS=${TESTS_DIR}/${TEST_PREFIX}.js
  local result=0

  export SERVER_ADDRESS=${SERVER_ADDRESS:-'127.0.0.1'}
  export SERVER_PORT=${NAILGUN_PORT}
  export nailgun_plugins_path='/var/www/nailgun/plugins'

  pip install python-fuelclient
  fuelclient="${VENV}/lib/python2.7/site-packages/fuelclient"
  sed -i -e "s/if self.auth_required/if True/" "${fuelclient}/client.py"

  echo "Building tests..."
  ${GULP} intern:transpile

  if [ "${NO_NAILGUN_START}" -ne 1 ]; then
      pushd "$FUEL_WEB_ROOT" > /dev/null
      tox -e stop
      tox -e cleanup
      tox -e start
      ./nailgun/manage.py loaddata nailgun/nailgun/fixtures/sample_environment.json
      popd > /dev/null
  fi

  install_prepare_plugin "${PLUGIN_RPM}"

  ${GULP} build --no-sourcemaps --extra-entries=sinon --static-dir="$NAILGUN_STATIC"
  if [ $? -ne 0 ]; then
    return 1
  fi

  for test_case in $TESTS; do
    echo "INFO: Running test case ${test_case}"

    ARTIFACTS=$ARTIFACTS \
    ${GULP} functional-tests --no-transpile --suites="${test_case}" || result=1
  done

  remove_plugin

  if [ "${NO_NAILGUN_START}" -ne 1 ]; then
    pushd "$FUEL_WEB_ROOT" > /dev/null
    tox -e stop
    popd > /dev/null
  fi

  return $result
}

run_component_tests
