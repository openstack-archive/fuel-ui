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
import assert from 'intern/chai!assert';
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
    afterEach() {
      return this.remote
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges());
    },
    'Provision nodes'() {
      this.timeout = 100000;
      return this.remote
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.provision button')
        .assertElementContainsText(
          '.btn-provision',
          'Provision 1 Node',
          '1 node to be provisioned'
        )
        .clickByCssSelector('.btn-provision')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Provision Nodes'))
        .then(() => modal.clickFooterButton('Provision 1 Node'))
        .then(() => modal.waitToClose())
        .assertElementAppears('div.deploy-process div.progress', 2000, 'Provisioning started')
        .assertElementDisappears('div.deploy-process div.progress', 15000, 'Provisioning finished')
        .assertElementContainsText(
          'div.alert-success strong',
          'Success',
          'Provisioning successfully finished'
        )
        .then(() => clusterPage.isTabLocked('Networks'))
        .then((isLocked) => {
          assert.isFalse(isLocked, 'Networks tab is not locked after nodes were provisioned');
        })
        .then(() => clusterPage.isTabLocked('Settings'))
        .then((isLocked) => {
          assert.isFalse(isLocked, 'Settings tab is not locked after nodes were provisioned');
        })
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementEnabled(
          dashboardPage.deployButtonSelector,
          'Provisioned nodes can be deployed'
        )
        .then(() => common.addNodesToCluster(2, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.provision button')
        .clickByCssSelector('.changes-list .dropdown-toggle')
        .clickByCssSelector('.changes-list .btn-select-nodes')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Select Nodes'))
        .assertElementsExist(
          '.modal .node.selected',
          2,
          'All available nodes are selected for provisioning'
        )
        .assertElementContainsText(
          '.modal-footer .btn-success',
          'Select 2 Nodes',
          'Select Nodes dialog confirmation button has a proper text'
        )
        .assertElementNotExists(
          '.modal .node-management-panel .control-buttons-box .btn',
          'There are no batch action buttons in Select Nodes dialog'
        )
        .clickByCssSelector('.modal .node-management-panel .btn-sorters')
        .clickByCssSelector('.modal .sorters .more-control .dropdown-toggle')
        .clickByCssSelector('.modal .sorters .popover input[name=manufacturer]')
        .assertElementsExist(
          '.modal .nodes-group',
          2,
          'Node sorting in Select nodes dialog works'
        )
        .clickByCssSelector('.modal .node-management-panel .btn-filters')
        .clickByCssSelector('.modal .filters .more-control .dropdown-toggle')
        .clickByCssSelector('.modal .filters .popover input[name=hdd]')
        .setInputValue('.modal .filters .popover input[name=end]', '1000')
        .assertElementsExist(
          '.modal .node',
          1,
          'Node filtering in Select nodes dialog works'
        )
        .clickByCssSelector('.modal .filters .btn-reset-filters')
        .clickByCssSelector('.modal .node-list-header input[name=select-all]')
        .assertElementDisabled(
          '.modal-footer .btn-success',
          'No nodes selected for provisioning'
        )
        .clickByCssSelector('.modal .node')
        .then(() => modal.clickFooterButton('Select 1 Node'))
        .then(() => modal.waitToClose())
        .assertElementContainsText(
          '.btn-provision',
          'Provision 1 of 2 Nodes',
          '1 of 2 nodes to be provisioned'
        )
        .clickByCssSelector('.btn-provision')
        .then(() => modal.waitToOpen())
        .then(() => modal.clickFooterButton('Provision 1 Node'))
        .then(() => modal.waitToClose())
        .assertElementAppears('div.deploy-process div.progress', 2000, 'Provisioning started')
        .assertElementDisappears('div.deploy-process div.progress', 5000, 'Provisioning finished')
        .then(() => clusterPage.goToTab('Nodes'))
        .assertElementsExist('.node.provisioned', 2, '2 of 3 nodes provisioned')
        .then(() => clusterPage.goToTab('Dashboard'));
    },
    'Deploy nodes'() {
      this.timeout = 100000;
      return this.remote
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.deployment button')
        .assertElementDisabled('.btn-deploy-nodes', 'There are no provisioned nodes to deploy')
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.provision button')
        .clickByCssSelector('.btn-provision')
        .then(() => modal.waitToOpen())
        .then(() => modal.clickFooterButton('Provision 1 Node'))
        .then(() => modal.waitToClose())
        .assertElementAppears('div.deploy-process div.progress', 2000, 'Provisioning started')
        .assertElementDisappears('div.deploy-process div.progress', 5000, 'Provisioning finished')
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.deployment button')
        .assertElementContainsText('.btn-deploy-nodes', 'Deploy 1 Node', '1 node to be deployed')
        .clickByCssSelector('.btn-deploy-nodes')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Deploy Nodes'))
        .then(() => modal.clickFooterButton('Deploy 1 Node'))
        .then(() => modal.waitToClose())
        .assertElementAppears('div.deploy-process div.progress', 2000, 'Deployment started')
        .assertElementDisappears('div.deploy-process div.progress', 10000, 'Deployment finished')
        .assertElementContainsText(
          'div.alert-success strong',
          'Success',
          'Deployment successfully finished'
        )
        .assertElementNotExists(
          dashboardPage.deployButtonSelector,
          'There are no changes to deploy in the environment'
        );
    },
    'Start/stop deployment'() {
      this.timeout = 100000;
      return this.remote
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears('div.deploy-process div.progress', 2000, 'Deployment started')
        .assertElementAppears(
          'button.stop-deployment-btn:not(:disabled)',
          5000,
          'Stop button appears'
        )
        .then(() => dashboardPage.stopDeployment())
        .assertElementDisappears('div.deploy-process div.progress', 20000, 'Deployment stopped')
        .assertElementAppears(
          dashboardPage.deployButtonSelector,
          3000,
          'Deployment button available'
        )
        .assertElementContainsText(
          'div.alert-warning strong',
          'Success',
          'Deployment successfully stopped alert is expected'
        )
        .assertElementNotExists(
          '.go-to-healthcheck',
          'Healthcheck link is not visible after stopped deploy'
        );
    },
    'Test deployed cluster'() {
      this.timeout = 100000;
      var cidrCssSelector = '.storage input[name=cidr]';
      var cidrDeployedValue;

      return this.remote
        .then(() => dashboardPage.startDeployment())
        .assertElementDisappears(
          '.dashboard-block .progress',
          60000,
          'Progress bar disappears after deployment'
        )
        .assertElementAppears('.links-block', 5000, 'Deployment completed')
        .assertElementExists('.go-to-healthcheck', 'Healthcheck link is visible after deploy')
        .findByLinkText('Horizon')
          .getProperty('href')
          .then((href) => {
            // check the link includes 'http(s)' and there is '.' in it's domain
            return assert.match(
              href,
              /^https?:\/\/[-\w]+\.[-\w.]+(:\d+)?\/?$/,
              'Link to Horizon is formed'
            );
          })
          .end()
        .then(() => clusterPage.goToTab('Networks'))
        .assertElementEnabled(
          '.add-nodegroup-btn',
          'Add Node network group button is enabled after cluster deploy'
        )
        .findByCssSelector(cidrCssSelector)
          .then(
            (element) => element.getProperty('value')
              .then((value) => {
                cidrDeployedValue = value;
              })
          )
          .end()
        .setInputValue(cidrCssSelector, '192.168.1.0/25')
        .clickByCssSelector('.apply-btn:not(:disabled)')
        .waitForCssSelector(cidrCssSelector + ':not(:disabled)', 1000)
        .clickByCssSelector('.btn-load-deployed')
        .waitForCssSelector('.apply-btn:not(:disabled)', 1000)
        .then(
          () => this.remote.assertElementPropertyEquals(
            cidrCssSelector,
            'value',
            cidrDeployedValue,
            'Load Deployed Settings button works properly'
          )
        )
        .clickByCssSelector('.btn-revert-changes')
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementContainsText(
          '.actions-panel .changes-item',
          'Changed environment configuration',
          'Discard changed environment configuration button is shown on Dashboard'
        )
        .clickByCssSelector('.actions-panel .btn-discard-changes')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Discard Changes'))
        .then(() => modal.clickFooterButton('Discard'))
        .then(() => modal.waitToClose())
        .assertElementNotExists(
          '.actions-panel .btn-discard-changes',
          'No changes in the deployed environment'
        )
        .then(() => clusterPage.goToTab('Networks'))
        .then(
          () => this.remote.assertElementPropertyEquals(
            cidrCssSelector,
            'value',
            cidrDeployedValue,
            'Network settings are reset to their deployed state'
          )
        )
        .then(() => clusterPage.goToTab('Settings'))
        .clickLinkByText('Security')
        .clickByCssSelector('input[type=checkbox]')
        .clickByCssSelector('.btn-apply-changes:not(:disabled)')
        .waitForCssSelector('input[type=checkbox]:not(:disabled)', 1000)
        .clickByCssSelector('.btn-load-deployed')
        .assertElementEnabled(
          '.btn-apply-changes:not(:disabled)',
          'Deployed configuration restored and can be saved'
        )
        .clickByCssSelector('.btn-revert-changes')
        .then(() => clusterPage.goToTab('Dashboard'))
        .assertElementContainsText(
          '.actions-panel .changes-item',
          'Changed environment configuration',
          'There are changes in the environment to deploy'
        );
    }
  };
});
