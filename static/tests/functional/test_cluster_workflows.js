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
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import ModalWindow from 'tests/functional/pages/modal';

registerSuite(() => {
  var common,
    clusterPage,
    dashboardPage,
    clusterName,
    modal;

  return {
    name: 'Logs Tab',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');
      dashboardPage = new DashboardPage(this.remote);
      modal = new ModalWindow(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']));
    },
    'Test Dashboard tab without custom workflow deployment mode'() {
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .assertElementNotExists('.actions-panel .dropdown .dropdown-menu li.custom_graph',
          'There is no possibility to run custom workflow for just created environment');
    },
    'Test Workflows tab view and filters'() {
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        // FIXME(kpimenova): after #1606931 fix we'll fetch graphs of all levels,
        // so there shoul be more graphs in the list
        .assertElementsExist('.workflows-table tbody tr', 2,
          'Check if workflow table is presented and there are two rows in the table')
        .assertElementContainsText('.workflows-table tbody tr:first-child td:first-child',
            'Type "default"', 'The first row is default resulting graph for the cluster')
        .assertElementExists('.workflows-table tbody tr:last-child .btn-remove-graph',
            'There is a possibility to delete default cluster graph')
        .assertElementNotExists('.workflows-table tbody tr:first-child .btn-remove-graph',
            'There is no possibility to delete resulting graph for the cluster')
        .assertElementExists('.deployment-graphs-toolbar .btn-filters',
          'Filter button for workflows tab is presented')
        // Check filters functionality
        .clickByCssSelector('.deployment-graphs-toolbar .btn-filters')
        .assertElementsAppear('.filters .filter-control', 200,
          'Filters section is open')
        .assertElementsExist('.filters .filter-by-graph_level, .filters .filter-by-graph_type', 2,
          'Two filters are presented: filter for graph level and graph type')
        // Filter results by Level: plugin
        .clickByCssSelector('.filter-by-graph_level')
        .clickByCssSelector('input[name=plugin]')
        .assertElementNotExists('.workflows-table',
          'Workflows table doesn\'t have plugin workflows, so workflows table disappears')
        .assertElementExists('.alert-warning',
          'Warning message is shown and informs that no workflows matched applied filters.')
        .clickByCssSelector('.btn-reset-filters')
        .assertElementsAppear('.workflows-table tbody tr', 200,
          'Workflow table is presented again after filters reset');
    },
    'Test upload new custom Workflow'() {
      return this.remote
        .clickByCssSelector('.btn-upload-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Upload New Workflow'))
        .assertElementsExist('.upload-graph-form',
          'Upload graph form is presented in the dialog window')
        // Form validation check
        .then(() => modal.clickFooterButton('Upload'))
        .assertElementAppears('.upload-graph-form .has-error', 200,
          'There is an error in the form in case type field is empty')
        // Fill the upload form with test data
        .setInputValue('.upload-graph-form input[name=name]', 'loremipsum')
        .setInputValue('.upload-graph-form input[name=type]', 'loremipsum')
        .assertElementNotExists('.upload-graph-form .has-error', 200,
          'Error message disappears after filling type field')
        .then(() => modal.clickFooterButton('Upload'))
        .then(() => modal.waitToClose())
        .assertElementContainsText('.workflows-table tbody tr:last-child td:first-child',
          'loremipsum', 'New graph successfully uploaded')
        // Check validation error if graph with this type already exists
        .clickByCssSelector('.btn-upload-graph')
        .then(() => modal.waitToOpen())
        .setInputValue('.upload-graph-form input[name=type]', 'loremipsum')
        .then(() => modal.clickFooterButton('Upload'))
        .assertElementAppears('.upload-graph-form .has-error', 200,
          'There is an error in the form in case if graph with this type already exists')
        .then(() => modal.clickFooterButton('Cancel'))
        .then(() => modal.waitToClose());
    },
    'Test run custom Workflow from Dashboard tab'() {
      this.timeout = 150000;
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.custom_graph button')
        .assertElementPropertyEquals('select[name=customGraph]', 'value', 'loremipsum',
          'Custom workflow dropdown exists and shows just uploaded "loremipsum" graph')
        .assertElementContainsText('.btn-run-graph', 'Run Workflow on 1 Node',
          'Workflow runs on 1 node')
        .clickByCssSelector('.btn-run-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Run Custom Workflow'))
        .assertElementContainsText('.confirmation-question', 'Click Run Workflow to execute ' +
          'custom deployment tasks on the selected nodes.', 'Confirmation quiestion is shown')
        .then(() => modal.clickFooterButton('Run Workflow'))
        .then(() => modal.waitToClose())
        .waitForElementDeletion('.dashboard-block .progress', 60000)
        .assertElementAppears('.alert-success', 20000, 'Workflow deployment completed')
        .then(() => dashboardPage.startDeployment())
        .waitForElementDeletion('.dashboard-block .progress', 60000)
        .assertElementAppears('.actions-panel', 200,
          'Action panel is shown on the dashboard')
        .assertElementPropertyEquals('select[name=customGraph]', 'value', 'loremipsum',
          'Custom workflow dropdown is shown on the dashboard for the operational cluster')
        .assertElementContainsText('.btn-run-graph', 'Run Workflow on 1 Node',
          'There is possibility to run custom graph for operational cluster');
    },
    'Test delete Workflow'() {
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        .clickByCssSelector('.workflows-table tbody tr:last-child .btn-remove-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Delete Workflow'))
        .assertElementExists('.modal-dialog .text-danger',
          'Warning message is shown to prevent accidental graph removing')
        .then(() => modal.clickFooterButton('Delete'))
        .assertElementAppears('.confirm-deletion-form', 200,
          'Confirmation form for graph removingis is shown')
        .assertElementDisabled('.modal-footer .remove-graph-btn',
          'Delete button is disabled, until requested confirmation text will be entered')
        .setInputValue('.confirm-deletion-form input[type=text]', 'loremipsum')
        .assertElementEnabled('.modal-footer .remove-graph-btn',
          'Delete button is enabled after requested confirmation text entered')
        .then(() => modal.clickFooterButton('Delete'))
        .then(() => modal.waitToClose())
        // FIXME: It seems that after #1606931 fix custom graph will be not the last in the list
        .assertElementNotContainsText('.workflows-table tbody tr:last-child td:first-child',
          'loremipsum', 'The graph was successfully deleted');
    }
  };
});
