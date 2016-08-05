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
import ModalWindow from 'tests/functional/pages/modal';

registerSuite(() => {
  var common,
    clusterPage,
    clusterName,
    modal;

  return {
    name: 'Logs Tab',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');
      modal = new ModalWindow(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => clusterPage.goToTab('Workflows'));
    },
    'Test Workflows tab view and filters'() {
      return this.remote
      .assertElementsExist('.workflows-table tbody tr',
        'Check if workflow table is presented and there are several rows in the table')
      .assertElementExists('.deployment-graphs-toolbar .btn-filters',
        'Filter button for workflows tab is presented')
      // Check filters functionality
      .clickByCssSelector('.deployment-graphs-toolbar .btn-filters')
      .assertElementsAppear('.filters .filter-control', 100,
        'Filters section is open, and several filter dropdowns are presented')
      // Filter results by Level: plugin
      .clickByCssSelector('.filter-by-graph_level')
      .clickByCssSelector('input[name=plugin]')
      .assertElementAppears('.btn-reset-filters', 100,
        'Reset button is presented after filter applies')
      .assertElementNotExists('.workflows-table',
        'Workflows table doesn\'t have plugin workflows, so workflows table disappears')
      .assertElementExists('.alert-warning',
        'Warning message is shown and informs that no workflows matched applied filters.')
      // Reset filters
      .clickByCssSelector('.btn-reset-filters')
      .assertElementsAppear('.workflows-table tbody tr', 100,
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
        .assertElementAppears('.upload-graph-form .has-error', 100,
          'There is an error in the form in case type field is empty')
        // Fill the upload form with test data
        .setInputValue('.upload-graph-form input[name=name]', 'loremipsum')
        .setInputValue('.upload-graph-form input[name=type]', 'loremipsum')
        .assertElementNotExists('.upload-graph-form .has-error', 100,
          'Error message disappears after filling type field')
        .then(() => modal.clickFooterButton('Upload'))
        .then(() => modal.waitToClose())
        .assertElementContainsText('.workflows-table tbody tr:last-child td:first-child',
          'loremipsum', 'New graph successfully uploaded');
    },
    'Test run custom Workflow from Dashboard tab'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
        .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.custom_graph button')
        .assertElementPropertyEquals('select[name=customGraph]', 'value', 'loremipsum',
          'Custom workflow dropdown exists and shows just uploaded "loremipsum" graph')
        .assertElementContainsText('.btn-run-graph', 'Run Workflow on 1 Node',
          'Workflow runs on 1 node')
        // Run custom graph deployment
        .clickByCssSelector('.btn-run-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Run Custom Workflow'))
        .assertElementContainsText('.confirmation-question', 'Click Run Workflow to execute ' +
          'custom deployment tasks on the selected nodes.', 'Confirmation quiestion is shown')
        .then(() => modal.clickFooterButton('Run Workflow'))
        .then(() => modal.waitToClose())
        .assertElementDisappears(
          '.dashboard-block .progress',
          60000,
          'Progress bar disappears after deployment'
        )
        .assertElementAppears('.alert-success', 20000, 'Workflow deployment completed');
    },
    'Test delete Workflow'() {
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        .clickByCssSelector('.workflows-table tbody tr:last-child .btn-remove-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Delete Workflow'))
        .assertElementExists('.modal-dialog .text-danger',
          'Warning message is shown to prevent accidental graph romoving')
        .then(() => modal.clickFooterButton('Delete'))
        .assertElementAppears('.confirm-deletion-form', 100,
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
