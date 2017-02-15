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

# Variables for remote (master node)
export REMOTE_HOST=${REMOTE_HOST:-'10.109.0.2'}
export REMOTE_USER=${REMOTE_USER:-'root'}
export REMOTE_SSH_PORT=${REMOTE_SSH_PORT:-22}
export REMOTE_PASSWORD=${REMOTE_PASSWORD:-'r00tme'}
export REMOTE_DIR=${REMOTE_DIR:-'/root'}

export FUEL_UI_HOST=${FUEL_UI_HOST:-${REMOTE_HOST}}

export REMOTE_EXEC="sshpass -p ${REMOTE_PASSWORD}
                    ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no
                        -p ${REMOTE_SSH_PORT} ${REMOTE_USER}@${REMOTE_HOST}"

# Variables for tests
export TESTS_ROOT="$(pwd)/static/tests/functional/real_plugin"
export SCRIPT_PATH="${TESTS_ROOT}/update_plugin_on_real.sh"
export TEST_PREFIX=${TEST_PREFIX:-'test_*'}
export TESTS_DIR_NAME=${TESTS_DIR_NAME:-'feature_nics'}
export CONF_PATH="${TESTS_ROOT}/${TESTS_DIR_NAME}/plugin_conf"

export ARTIFACTS=${ARTIFACTS:-"$(pwd)/test_run/${TESTS_DIR_NAME}"}

plugins='https://product-ci.infra.mirantis.net/view/All/job/9.0.build-fuel-plugins'
path='lastSuccessfulBuild/artifact/built_plugins/fuel_plugin_example_v5-1.0-1.0.0-1.noarch.rpm'
plugin_url=${PLUGIN_URL:-"${plugins}/${path}"}

plugins='http://plugins.mirantis.com/repository/f/u/fuel-plugin-vmware-dvs'
path='fuel-plugin-vmware-dvs-3.1-3.1.0-1.noarch.rpm'
plugin2_url=${PLUGIN_URL_SECOND:-"${plugins}/${path}"}

export NAILGUN_STATIC=$ARTIFACTS/static
mkdir -p "$ARTIFACTS"

function install_prepare_plugin {
  url=$1
  file_name=$2
  ${REMOTE_EXEC} wget --no-check-certificate -O "${REMOTE_DIR}/${file_name}.rpm" "${url}"

  export PLUGIN_PATH=$(
    ${REMOTE_EXEC} fuel plugins --install "${REMOTE_DIR}/${file_name}.rpm" | awk '/Installing:/ { getline; print $1 }'
  )

  export PLUGIN_PATH="/var/www/nailgun/plugins/${PLUGIN_PATH}"

  meta="${PLUGIN_PATH}/metadata.yaml"
  export plugin_name=$(${REMOTE_EXEC} egrep '^name: ' "${meta}" | cut -d ' ' -f 2)
  export plugin_version=$(${REMOTE_EXEC} egrep '^version: ' "${meta}" | cut -d ' ' -f 2)

  # Fix package version and release versions
  ${REMOTE_EXEC} sed -i -e '$!s/4.0.0/5.0.0/' -e '$!s/9.0/10.0/g' -e '$!s/mitaka/newton/' ${meta}
  ${REMOTE_EXEC} fuel plugins --sync

  # Fix components settings
  ${REMOTE_EXEC} sed -i '/requires/,/+$/s/^/#/' ${PLUGIN_PATH}/components.yaml

  # Remove vmware dependencies
  ${REMOTE_EXEC} sed -i '/restrictions/,/+4/s/^/#/' ${PLUGIN_PATH}/environment_config.yaml
  ${REMOTE_EXEC} fuel plugins --sync

  export INSTALLED_PLUGINS="${INSTALLED_PLUGINS};${plugin_name}==${plugin_version//\'/}"
}

function remove_plugin {
  for plug in $(echo ${INSTALLED_PLUGINS} | tr ";" "\n")
  do
    ${REMOTE_EXEC} fuel plugins --remove "${plug}" 2>/dev/null && \
    echo "${plug} was removed" || echo "Can not remove plugin ${plug}"
  done
}

function remote_scp {
  local_file=$1

  sshpass -p ${REMOTE_PASSWORD} \
    scp -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no \
        -P ${REMOTE_SSH_PORT} $local_file ${REMOTE_USER}@${REMOTE_HOST}:/${REMOTE_DIR}/
}

function run_tests {
  local GULP='./node_modules/.bin/gulp'
  local TESTS_DIR="static/tests/functional/real_plugin/${TESTS_DIR_NAME}"
  local TESTS=${TESTS_DIR}/${TEST_PREFIX}.js
  local result=0

  export INSTALLED_PLUGINS=''

  if [ ${TESTS_DIR_NAME} == 'feature_nics' ]; then
    install_prepare_plugin ${plugin2_url} "plugin2"
    for conf in 'nic' 'node' 'bond'; do
      remote_scp ${CONF_PATH}/${conf}_plugin2.yaml
      ${REMOTE_EXEC} cp ${REMOTE_DIR}/${conf}_plugin2.yaml ${PLUGIN_PATH}/${conf}_config.yaml
    done
  fi
  local plugin1_path=${PLUGIN_PATH}/environment_config.yaml

  install_prepare_plugin ${plugin_url} "plugin"

  ${REMOTE_EXEC} cp ${PLUGIN_PATH}/environment_config.yaml ${plugin1_path}
  ${REMOTE_EXEC} sed -i '$!s/fuel.*/dvs/' ${meta}
  ${REMOTE_EXEC} fuel plugins --sync

  ${GULP} intern:transpile

  for test_case in $TESTS; do
    echo "INFO: Running test case ${test_case}"

    ARTIFACTS=$ARTIFACTS \
    ${GULP} intern:run --suites="${test_case}" || result=1
  done

  remove_plugin

  return $result
}

run_tests
