#!/usr/bin/env bash

function remote_scp {
  local_file=$1

  sshpass -p ${REMOTE_PASSWORD} scp -P ${REMOTE_SSH_PORT} $local_file ${REMOTE_USER}@${REMOTE_IP}:/${REMOTE_DIR}/
}
function update_components {
  default=${CONF_PATH}/$1.yaml
  components_file=${CONF_PATH}/$2.yaml

  remote_scp ${components_file}
  remote_scp ${default}

  ${REMOTE_EXEC} sh -c "cat ${REMOTE_DIR}/$1.yaml ${REMOTE_DIR}/$1.yaml > ${PLUGIN_PATH}/components.yaml"
}

function update_nics {
  nic_file=${CONF_PATH}/$1.yaml

  remote_scp ${nic_file}
  ${REMOTE_EXEC} cp ${REMOTE_DIR}/$1.yaml ${PLUGIN_PATH}/nic_config.yaml
}

function update_nodes {
  node_file=${CONF_PATH}/$1.yaml

  remote_scp ${node_file}
  ${REMOTE_EXEC} cp ${REMOTE_DIR}/$1.yaml ${PLUGIN_PATH}/node_config.yaml
}

function update_bonds {
  bond_file=${CONF_PATH}/$1.yaml

  remote_scp ${bond_file}
  ${REMOTE_EXEC} cp ${REMOTE_DIR}/$1.yaml ${PLUGIN_PATH}/bond_config.yaml
}

case $1 in
  update_components|update_nics|update_nodes|update_bonds)  func=$1; params="${@:2}";;
  *)  func=update_components;  params="$@";;
esac

$func $params

${REMOTE_EXEC} fuel plugins --sync
