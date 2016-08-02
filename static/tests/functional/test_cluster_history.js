/*
 * Copyright 2015 Mirantis, Inc.
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
import Common from 'tests/functional/pages/common';
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
    name: 'Cluster deployment',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      modal = new ModalWindow(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    beforeEach() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Test deployment history'() {
      this.timeout = 100000;

      return this.remote
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears('.toggle-history .btn', 1000,
          'Deployment starts and Show Details button is shown')
        .clickByCssSelector('.toggle-history .btn')
        .assertElementAppears('.deployment-history-table', 100,
          'Deployment history timeline is shown')
        .assertElementsExist('.deployment-history-table .node-timelines .timelines > div', 2,
          'Two timelines are shown - for master and slave node')
        .assertElementsAppear('.deployment-timeline .timelines .node-task', 20000,
          'Deployment tasks appear on the timeline')
        .assertElementDisappears(
          '.dashboard-block .progress',
          60000,
          'Progress bar disappears after deployment'
        )
        .assertElementAppears('.links-block', 20000, 'Deployment completed')
        .then(() => clusterPage.goToTab('History'))
        .assertElementAppears('.deployment-history-table', 100,
          'Deployment history timeline is shown on History tab')
        .assertElementExists('.transaction-list .transaction-link',
          'There is only one deployment transaction for this cluster')
        .clickByCssSelector('.deployment-history-toolbar .view-modes .table-view')
        .assertElementAppears('.history-table table', 100,
          'Deployment history switched into table view')
        .clickByCssSelector('.history-table tr td .btn-link')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Deployment Task Details'))
        .assertElementsExist('.deployment-task-details-dialog .main-attribute',
          'Main attributes for tasks are presented on task details dialog')
        .then(() => modal.clickFooterButton('Close'))
        .then(() => modal.waitToClose());
    },
    'Test second deployment history'() {
      this.timeout = 100000;

      return this.remote
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears('.toggle-history .btn', 1000,
          'Deployment starts and Show Details button is shown')
        .clickByCssSelector('.toggle-history .btn')
        .assertElementAppears('.deployment-history-table', 100,
          'Deployment history timeline is shown')
        .assertElementsAppear('.deployment-timeline .timelines .node-task', 20000,
          'Deployment tasks appear on the timeline')
        .assertElementsExist('.deployment-history-table .node-timelines .timelines > div', 3,
         'Three timelines are shown - for master and two slave nodes')
        .assertElementDisappears(
          '.dashboard-block .progress',
          60000,
          'Progress bar disappears after deployment'
        )
        .assertElementAppears('.links-block', 20000, 'Deployment completed')
        .then(() => clusterPage.goToTab('History'))
        .assertElementsExist('.transaction-list .transaction-link', 2,
          'There are two deployment transactions shown for this cluster');
    }
  };
});
