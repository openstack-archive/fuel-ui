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
  var common, clusterPage, dashboardPage, modal, clusterName;
  var tableHistorySelector = '.deployment-history-table ';
  var timelineSelector = '.deployment-timeline ';
  var timelineHistorySelector = tableHistorySelector + timelineSelector;
  var historyToolbarSelector = '.deployment-history-toolbar ';
  var buttonTableSelector = historyToolbarSelector + '.view-modes .table-view';
  var buttonTimelineSelector = historyToolbarSelector + '.view-modes .timeline-view';
  var tableViewSelector = '.history-table table ';
  var progressSelector = '.dashboard-block .progress';

  return {
    name: 'Deployment History',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      modal = new ModalWindow(this.remote);
      clusterName = common.pickRandomName('History Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']));
    },
    'Check deployment history tab before deployment'() {
      var titleSelector = 'div.title';
      return this.remote
        .then(() => clusterPage.goToTab('History'))
        .assertElementAppears(titleSelector, 5000, '"Deployment History" title appears')
        .assertElementContainsText(titleSelector, 'Deployment History',
          '"Deployment History" title is correct')
        .assertElementContainsText('.alert-warning', 'No deployment finished yet.',
          'History is empty for a cluster before deployment');
    },
    'Check deployment history timeline via deployment'() {
      this.timeout = 90000;
      var currentTimeMarkerPosition;
      var showDetailsSelector = '.toggle-history .btn';
      var tasksSelector = timelineSelector + '.timelines .node-task';
      var timeMarkerSelector = '.current-time-marker';
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears(showDetailsSelector, 5000,
          'Deployment is started and "Show Details" button is shown')
        .clickByCssSelector(showDetailsSelector)
        .assertElementExists(timelineHistorySelector, 'Deployment history timeline is shown')
        .clickByCssSelector(buttonTableSelector)
        .assertElementExists(tableViewSelector, 'Deployment history switched into table view')
        .clickByCssSelector(buttonTimelineSelector)
        .assertElementsExist(historyToolbarSelector + '.zoom-controls .btn-group button:disabled',
          2, 'Two buttons are presented and disabled in zoom control')
        .assertElementsExist(timelineSelector + '.node-names div', 2,
          'Two timelines are shown - for master and slave node')
        .assertElementsAppear(tasksSelector, 20000, 'Deployment tasks appear on the timeline')
        .assertElementAppears(timeMarkerSelector, 5000, 'Time marker appears on the timeline')
        .findByCssSelector(timeMarkerSelector)
          .getComputedStyle('left')
          .then((value) => {currentTimeMarkerPosition = parseInt(value.split(' ')[0], 10);})
          .end()
        // .then(pollUntil(() => window.$(tasksSelector).length >= 4 || null, 60000))
        .then(pollUntil(() =>
          window.$('.deployment-timeline .timelines .node-task').length >= 4 || null, 60000))
        .findByCssSelector(timeMarkerSelector)
          .getComputedStyle('left')
          .then((value) => {
            return assert.isTrue(parseInt(value.split(' ')[0], 10) > currentTimeMarkerPosition,
              'Current time marker is moving showing tasks progress');
          })
          .end()
        .waitForElementDeletion(progressSelector, 30000);
    },
    'Check that "History" tab is worked after deployment'() {
      var deploymentTasksNumber;
      var buttonFilterSelector = historyToolbarSelector + '.btn-filters';
      var tbodySelector = tableViewSelector + 'tbody tr';
      var filterNodeId = '.filters .filter-by-node_id';
      return this.remote
        .then(() => clusterPage.goToTab('History'))
        .assertElementExists(timelineHistorySelector, 'Deployment history timeline is shown')
        .assertElementExists('.transaction-list .transaction-link',
          'There is only one deployment transaction for this cluster')
        .clickByCssSelector(buttonTableSelector)
        .assertElementExists(tableViewSelector, 'Deployment history switched into table view')
        .clickByCssSelector('.history-table tr td .btn-link')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Deployment Task Details'))
        .assertElementsExist('.deployment-task-details-dialog .main-attribute',
          'Main attributes for tasks are presented on task details dialog')
        .then(() => modal.clickFooterButton('Close'))
        .then(() => modal.waitToClose())
        .assertElementExists(buttonFilterSelector, 'Filter button exists in history table view')
        .clickByCssSelector(buttonFilterSelector)
        .assertElementsExist(
          '.filters .filter-by-task_name, ' + filterNodeId + ', .filters .filter-by-status',
          3, 'Three filters are presented: filter by Task Name, by Node ID, and by Task status')
        .findAllByCssSelector(tbodySelector)
          .then((elements) => {deploymentTasksNumber = elements.length;})
          .end()
        .clickByCssSelector(filterNodeId)
        .clickByCssSelector('.popover-content .checkbox-group input[name="master"]')
        .findAllByCssSelector(tbodySelector)
          .then((elements) => {
            return assert.isTrue(deploymentTasksNumber > elements.length,
              'Filter by node ID works and shows tasks only for master node');
          })
          .end();
    },
    'Check that "History" tab is worked after second cluster deployment'() {
      this.timeout = 90000;
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .waitForElementDeletion(progressSelector, 60000)
        .then(() => clusterPage.goToTab('History'))
        .assertElementsExist('.transaction-list .transaction-link', 2,
          'There are two deployment transactions shown for this cluster');
    }
  };
});
