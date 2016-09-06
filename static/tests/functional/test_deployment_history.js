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

import registerSuite from 'intern!object';
import assert from 'intern/chai!assert';
import Common from 'tests/functional/pages/common';
import pollUntil from 'intern/dojo/node!leadfoot/helpers/pollUntil';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

registerSuite(() => {
  var common,
    clusterPage,
    dashboardPage,
    modal,
    clusterName;

  return {
    name: 'Deployment History',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      modal = new ModalWindow(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']));
    },
    'Test deployment history timeline of running deployment'() {
      this.timeout = 100000;
      var currentTimeMarkerPosition;

      return this.remote
        .then(() => clusterPage.goToTab('History'))
        .assertElementContainsText(
          '.alert-warning',
          'No deployment finished yet.',
          'History is empty for a new cluster'
        )
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears(
          '.toggle-history .btn',
          5000,
          'Deployment starts and Show Details button is shown'
        )
        .clickByCssSelector('.toggle-history .btn')
        .assertElementExists(
          '.deployment-history-table .deployment-timeline',
          'Deployment history timeline is shown'
        )
        .clickByCssSelector('.deployment-history-toolbar .view-modes .table-view')
        .assertElementExists(
          '.history-table table',
          'Deployment history switched into table view'
        )
        .clickByCssSelector('.deployment-history-toolbar .view-modes .timeline-view')
        .assertElementsExist(
          '.deployment-history-toolbar .zoom-controls .btn-group button:disabled',
          2,
          'Two buttons are presented and disabled in zoom control'
        )
        .assertElementsExist(
          '.deployment-timeline .node-names > div',
          2,
          'Two timelines are shown - for master and slave node'
        )
        .assertElementsAppear(
          '.deployment-timeline .timelines .node-task',
          20000,
          'Deployment tasks appear on the timeline'
        )
        .assertElementAppears(
          '.current-time-marker',
          5000,
          'Time marker appears on the timeline'
        )
        .findByCssSelector('.current-time-marker')
          .getComputedStyle('left')
          .then((value) => {
            currentTimeMarkerPosition = parseInt(value.split(' ')[0], 10);
          })
          .end()
        .then(
          pollUntil(
            // wait till 4 tasks appear on the timeline
            () => window.$('.deployment-timeline .timelines .node-task').length >= 4 || null,
            60000
          )
        )
        .findByCssSelector('.current-time-marker')
          .getComputedStyle('left')
          .then((value) => {
            // compare current time marker position with previous one
            return assert.isTrue(
              parseInt(value.split(' ')[0], 10) > currentTimeMarkerPosition,
              'Current time marker is moving showing tasks progress'
            );
          })
          .end()
        .waitForElementDeletion('.dashboard-block .progress', 40000);
    },
    'Test deployment history tab of finished deployment'() {
      var deploymentTasksNumber;

      return this.remote
        .then(() => clusterPage.goToTab('History'))
        .assertElementExists(
          '.deployment-history-table .deployment-timeline',
          'Deployment history timeline is shown on History tab'
        )
        .assertElementExists(
          '.transaction-list .transaction-link',
          'There is only one deployment transaction for this cluster'
        )
        .clickByCssSelector('.deployment-history-toolbar .view-modes .table-view')
        .assertElementExists(
          '.history-table table',
          'Deployment history switched into table view'
        )
        .clickByCssSelector('.history-table tr td .btn-link')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Deployment Task Details'))
        .assertElementsExist(
          '.deployment-task-details-dialog .row',
          'Main attributes for tasks are presented on task details dialog'
        )
        .then(() => modal.clickFooterButton('Close'))
        .then(() => modal.waitToClose())
        .assertElementExists(
          '.deployment-history-toolbar .btn-filters',
          'Filter button is presented in deployment history table view'
        )
        .clickByCssSelector('.deployment-history-toolbar .btn-filters')
        .assertElementsExist(
          '.filters .filter-by-task_name, .filters .filter-by-node_id, .filters .filter-by-status',
          3,
          'Three filters are presented: filter by Task Name, Node, and by Task Status'
        )
        .findAllByCssSelector('.history-table table tbody tr')
          .then((elements) => {
            deploymentTasksNumber = elements.length;
          })
          .end()
        .clickByCssSelector('.filters .filter-by-node_id')
        .clickByCssSelector('.popover-content .checkbox-group input[name="master"]')
        .findAllByCssSelector('.history-table table tbody tr')
          .then((elements) => {
            return assert.isTrue(
              deploymentTasksNumber > elements.length,
              'Filter by node ID works and shows tasks only for master node'
            );
          })
          .end();
    },
    'Test deployment history tab after second cluster deployment'() {
      this.timeout = 100000;
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .then(() => clusterPage.goToTab('History'))
        .assertElementsAppear(
          '.transaction-list .transaction-link',
          60000,
          'There are two deployment transactions shown for this cluster'
        );
    }
  };
});
