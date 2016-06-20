/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import utils from 'utils';
import {Input, Table} from 'views/controls';
import {TaskDetailsDialog} from 'views/dialogs';
import {DEPLOYMENT_TASK_STATUSES} from 'consts';

var ns = 'cluster_page.deployment_history.';

var DeploymentHistory = React.createClass({
  getInitialState() {
    return {
      filterByTaskName: null,
      filterByTaskStatus: null
    };
  },
  renderableTaskAttributes: ['task_name', 'status', 'time_start', 'time_end'],
  applyFilter(name, value) {
    this.setState({[name]: value || null});
  },
  showTaskDetails(taskData) {
    TaskDetailsDialog.show({
      taskData,
      preferredAttributesOrder: this.renderableTaskAttributes
    });
  },
  render() {
    var {filterByTaskName, filterByTaskStatus} = this.state;
    var {cluster, history} = this.props;

    // show master node tasks first
    var nodeIds = ['master'].concat(
      _.without(_.compact(_.uniq(history.map('node_id'))), 'master')
    );

    return (
      <div className='deployment-history-table'>
        <div className='deployment-history-toolbar well clearfix'>
          <div className='history-filters pull-right'>
            <Input
              type='select'
              name='filterByTaskName'
              value={filterByTaskName}
              label={i18n(ns + 'filter_by')}
              onChange={this.applyFilter}
            >
              {
                [<option key='default' value=''>{i18n(ns + 'filter_by_task_name')}</option>]
                  .concat(
                    _.uniq(history.map('task_name')).sort().map(
                      (name) => <option key={name} value={name}>{name}</option>
                    )
                  )
              }
            </Input>
            <Input
              type='select'
              name='filterByTaskStatus'
              value={filterByTaskStatus}
              onChange={this.applyFilter}
            >
              {
                [<option key='default' value=''>{i18n(ns + 'filter_by_task_status')}</option>]
                  .concat(
                    DEPLOYMENT_TASK_STATUSES.map(
                      (status) => <option key={status} value={status}>{status}</option>
                    )
                  )
              }
            </Input>
          </div>
        </div>
        {_.map(nodeIds, (nodeId) => {
          var nodeDeploymentTasks = history.filter({node_id: nodeId});
          var clusterNode = cluster.get('nodes').get(nodeId);
          return (
            <div className='node-history-table' key={nodeId}>
              <div className='node-history-table-title'>
                {nodeId === 'master' ?
                  i18n(ns + 'master_node_history_table_title')
                :
                  i18n(
                    ns + 'node_history_table_title',
                    {node: clusterNode ? clusterNode.get('name') : nodeId}
                  )
                }
              </div>
              <Table
                head={
                  this.renderableTaskAttributes
                    .map((attr) => ({label: i18n(ns + attr + '_header')}))
                    .concat([{label: ''}])
                }
                body={_.map(nodeDeploymentTasks,
                  (task) => {
                    if (
                      (!_.isNull(filterByTaskName) && task.get('task_name') !== filterByTaskName) ||
                      (!_.isNull(filterByTaskStatus) && task.get('status') !== filterByTaskStatus)
                    ) return;
                    return this.renderableTaskAttributes
                      .map((attr) => {
                        if (_.startsWith(attr, 'time')) {
                          return utils.formatTimestamp(task.get(attr));
                        }
                        return task.get(attr);
                      })
                      .concat([
                        <button
                          key={task.get('task_name') + 'details'}
                          className='btn btn-link'
                          onClick={() => this.showTaskDetails(task.attributes)}
                        >{i18n(ns + 'task_details')}</button>
                      ]);
                  }
                )}
              />
            </div>
          );
        })}
      </div>
    );
  }
});

export default DeploymentHistory;
