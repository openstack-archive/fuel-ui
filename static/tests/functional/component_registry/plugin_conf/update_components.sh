#!/usr/bin/env bash

default=${CONF_PATH}/$1.yaml
components_file=${CONF_PATH}/$2.yaml

sudo sh -c "cat ${components_file} ${default} > ${PLUGIN_PATH}/components.yaml"

fuel --os-username admin --os-password admin plugins --sync
