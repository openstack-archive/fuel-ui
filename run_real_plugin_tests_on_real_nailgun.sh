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

export FUEL_UI_HOST=${FUEL_UI_HOST:-'127.0.0.1'}

# Variables for remote (master node)
export REMOTE_IP=${REMOTE_IP:-'10.109.0.2'}
export REMOTE_USER=${REMOTE_USER:-'root'}
export REMOTE_SSH_PORT=${REMOTE_SSH_PORT:-23}
export REMOTE_PASSWORD=${REMOTE_PASSWORD:-'r00tme'}
export REMOTE_DIR=${REMOTE_DIR:-'/root'}

export REMOTE_EXEC="sshpass -p ${REMOTE_PASSWORD} ssh -p ${REMOTE_SSH_PORT} ${REMOTE_USER}@${REMOTE_IP}"
export REMOTE_SCP="sshpass -p ${REMOTE_PASSWORD} scp -p ${REMOTE_SSH_PORT} ${REMOTE_USER}@${REMOTE_IP}:/${REMOTE_DIR}/"

# Variables for tests
export TESTS_ROOT="$(pwd)/static/tests/functional/real_plugin"
export SCRIPT_PATH="${TESTS_ROOT}/update_plugin_on_real.sh"
export TEST_PREFIX=${TEST_PREFIX:-'test_*'}
export TESTS_DIR_NAME=${TESTS_DIR_NAME:-'feature_nics'}
export CONF_PATH="${TESTS_ROOT}/${TESTS_DIR_NAME}/plugin_conf"

export FUEL_WEB_ROOT=$(readlink -f ${FUEL_WEB_ROOT:-"$(dirname $0)/../fuel-web"})
export ARTIFACTS=${ARTIFACTS:-"$(pwd)/test_run/ui_component"}

plugins='https://product-ci.infra.mirantis.net/view/All/job/9.0.build-fuel-plugins'
path='lastSuccessfulBuild/artifact/built_plugins/fuel_plugin_example_v5-1.0-1.0.0-1.noarch.rpm'
plugin_url=${PLUGIN_URL:-"${plugins}/${path}"}

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
  ${REMOTE_EXEC} wget -O "${REMOTE_DIR}/plugin.rpm" "${plugin_url}"

  export PLUGIN_PATH=$(
    ${REMOTE_EXEC} fuel plugins --install "${REMOTE_DIR}/plugin.rpm" | awk '/Installing:/ { getline; print $1 }'
  )

  export PLUGIN_PATH="/var/www/nailgun/plugins/${PLUGIN_PATH}"

  meta="${PLUGIN_PATH}/metadata.yaml"
  export plugin_name=$(${REMOTE_EXEC} egrep '^name: ' "${meta}" | cut -d ' ' -f 2)
  export plugin_version=$(${REMOTE_EXEC} egrep '^version: ' "${meta}" | cut -d ' ' -f 2)

  # Fix components settings
  ${REMOTE_EXEC} sudo sed -i -e "s/requires/#requires/" ${PLUGIN_PATH}/components.yaml
  ${REMOTE_EXEC} sudo sed -i -e "s/incompatible/#incompatible/" ${PLUGIN_PATH}/components.yaml

  ${REMOTE_EXEC} fuel plugins --sync
}

function remove_plugin {
  ${REMOTE_EXEC} fuel plugins --remove "${plugin_name}==${plugin_version//\'/}" 2>/dev/null && \
    echo "${plugin_name} was removed" || echo "Can not remove plugin ${plugin_name}"
}

function run_component_tests {
  local GULP='./node_modules/.bin/gulp'
  local TESTS_DIR="static/tests/functional/real_plugin/${TESTS_DIR_NAME}"
  local TESTS=${TESTS_DIR}/${TEST_PREFIX}.js
  local result=0

  export SERVER_ADDRESS=${SERVER_ADDRESS:-'127.0.0.1'}
  export SERVER_PORT=${NAILGUN_PORT}

  install_plugin_on_real

  ${GULP} build --no-sourcemaps --extra-entries=sinon --static-dir="$NAILGUN_STATIC"
  if [ $? -ne 0 ]; then
    return 1
  fi

  for test_case in $TESTS; do
    echo "INFO: Running test case ${test_case}"

    ARTIFACTS=$ARTIFACTS \
    ${GULP} functional-tests --suites="${test_case}" || result=1
  done

  remove_plugin

  return $result
}

run_component_tests
