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
import pollUntil from 'intern/dojo/node!leadfoot/helpers/pollUntil';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import SettingsPage from 'tests/functional/pages/settings';
import NodeComponent from 'tests/functional/pages/node';
import ModalWindow from 'tests/functional/pages/modal';

registerSuite(() => {
  var common, clusterPage, settingsPage, node, modal;
  var clusterName = 'Plugin UI tests';
  var zabbixSectionSelector = '.setting-section-zabbix_monitoring ';

  return {
    name: 'Plugin UI tests',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      settingsPage = new SettingsPage(this.remote);
      node = new NodeComponent(this.remote);
      modal = new ModalWindow(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    beforeEach() {
      return this.remote
        .then(() => clusterPage.goToTab('Settings'))
        .clickByCssSelector('.subtab-link-other');
    },
    afterEach() {
      return this.remote
        .clickByCssSelector('.btn-load-defaults')
        .then(() => settingsPage.waitForRequestCompleted())
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted());
    },
    'Check plugin restrictions'() {
      var loggingSectionSelector = '.setting-section-logging ';
      return this.remote
        // activate Logging plugin
        .clickByCssSelector(loggingSectionSelector + 'h3 input[type=checkbox]')
        // activate Zabbix plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .assertElementEnabled(loggingSectionSelector + '[name=logging_text]',
          'No conflict with default Zabix plugin version')
        // change Zabbix plugin version
        .clickByCssSelector(zabbixSectionSelector +
          '.plugin-versions input[type=radio]:not(:checked)')
        .assertElementNotSelected(zabbixSectionSelector + '[name=zabbix_checkbox]',
          'Zabbix checkbox is not activated')
        .clickByCssSelector(zabbixSectionSelector + '[name=zabbix_checkbox]')
        .assertElementDisabled(loggingSectionSelector + '[name=logging_text]',
          'Conflict with Zabbix checkbox')
        // reset changes
        .clickByCssSelector('.btn-revert-changes');
    },
    'Check plugin in not deployed environment'() {
      var zabbixInitialVersion, zabbixTextInputValue;
      return this.remote
        .assertElementEnabled(zabbixSectionSelector + 'h3 input[type=checkbox]',
          'Plugin is changeable')
        .assertElementNotSelected(zabbixSectionSelector + 'h3 input[type=checkbox]',
          'Plugin is not actvated')
        .assertElementNotExists(zabbixSectionSelector + '> div input:not(:disabled)',
          'Inactive plugin attributes can not be changes')
        // activate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        // save changes
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted())
        .findByCssSelector(zabbixSectionSelector + '.plugin-versions input[type=radio]:checked')
          .getProperty('value')
            .then((value) => {
              zabbixInitialVersion = value;
            })
          .end()
        .findByCssSelector(zabbixSectionSelector + '[name=zabbix_text_1]')
          .getProperty('value')
            .then((value) => {
              zabbixTextInputValue = value;
            })
          .end()
        // change plugin version
        .clickByCssSelector(zabbixSectionSelector +
          '.plugin-versions input[type=radio]:not(:checked)')
        .assertElementPropertyNotEquals(zabbixSectionSelector + '[name=zabbix_text_1]', 'value',
          zabbixTextInputValue, 'Plugin version was changed')
        .assertElementExists('.subtab-link-other .glyphicon-danger-sign',
          'Plugin atributes validation works')
        // fix validation error
        .setInputValue(zabbixSectionSelector + '[name=zabbix_text_with_regex]', 'aa-aa')
        .waitForElementDeletion('.subtab-link-other .glyphicon-danger-sign', 1000)
        .assertElementEnabled('.btn-apply-changes', 'The plugin change can be applied')
        // reset plugin version change
        .clickByCssSelector('.btn-revert-changes')
        .then(
          () => this.remote.assertElementPropertyEquals(
            zabbixSectionSelector + '.plugin-versions input[type=radio]:checked',
            'value',
            zabbixInitialVersion,
            'Plugin version change can be reset'
          )
        );
    },
    'Check plugin in deployed environment'() {
      this.timeout = 100000;
      var zabbixInitialVersion;
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.deployEnvironment())
        .then(() => clusterPage.goToTab('Settings'))
        .findByCssSelector(zabbixSectionSelector + '.plugin-versions input[type=radio]:checked')
          .getProperty('value')
            .then((value) => {
              zabbixInitialVersion = value;
            })
          .end()
        // activate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .assertElementExists(
          zabbixSectionSelector + '.alert-warning',
          'Warning is shown for activated not hot pluggable version'
        )
        .clickByCssSelector(
          zabbixSectionSelector + '.plugin-versions input[type=radio]:not(:checked)'
        )
        .assertElementNotExists(
          zabbixSectionSelector + '.alert-warning',
          'Warning is not shown for activated hot pluggable version'
        )
        // fix validation error
        .setInputValue(zabbixSectionSelector + '[name=zabbix_text_with_regex]', 'aa-aa')
        .waitForElementDeletion('.subtab-link-other .glyphicon-danger-sign', 1000)
        .assertElementEnabled('.btn-apply-changes', 'The plugin change can be applied')
        // deactivate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .then(
          () => this.remote.assertElementPropertyEquals(
            zabbixSectionSelector + '.plugin-versions input[type=radio]:checked',
            'value',
            zabbixInitialVersion,
            'Initial plugin version is set for deactivated plugin'
          )
        )
        .assertElementDisabled('.btn-apply-changes', 'The change is reset successfully')
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => clusterPage.goToTab('Settings'));
    },
    'Check node and NIC plugins'() {
      var pluginSelector = '.setting-section-plugin_with_node_and_nic_attributes ';
      return this.remote
        .clickByCssSelector(pluginSelector + 'h3 input[type=checkbox]')
        .assertElementPropertyEquals(
          pluginSelector + '.plugin-versions input[type=radio]:checked',
          'value',
          '5', '1.0.0 node/NIC plugin version is chosen (version ID = 5)'
        )
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted())
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => node.openNodePopup())
        .clickByCssSelector('#headingattributes')
        .assertElementExists(
          '.setting-section-plugin_section_a',
          'Section A of node plugin presented in the node pop-up'
        )
        .assertElementDisabled(
          '.setting-section-plugin_section_a input[name=attribute_b]',
          'Attribute B of Section A of node plugin is disabled according to its restrictions'
        )
        .clickByCssSelector('.setting-section-plugin_section_a input[name=attribute_a]')
        .assertElementEnabled(
          '.setting-section-plugin_section_a input[name=attribute_b]',
          'Attribute B of Section A of node plugin is enabled'
        )
        .clickByCssSelector('.apply-changes:not(:disabled)')
        .then(() => modal.close())
        .clickByCssSelector('.node input[type=checkbox]')
        .clickByCssSelector('button.btn-configure-interfaces')
        .assertElementAppears('div.ifc-list', 5000, 'Node interfaces loaded')
        .then(pollUntil(() => window.$('div.ifc-list').is(':visible') || null, 1000))
        .assertElementsExist(
          '.property-item-container.plugin_with_node_and_nic_attributes',
          2,
          'NIC plugin presented on the node NICs'
        )
        .assertElementTextEquals(
          '.property-item-container.plugin_with_node_and_nic_attributes .btn-link',
          'Disabled',
          'NIC plugin is disabled by default'
        )
        .clickByCssSelector(
          '.property-item-container.plugin_with_node_and_nic_attributes .btn-link'
        )
        .assertElementDisabled(
          pluginSelector + 'input[name=attribute_b]',
          'Attribute B of NIC plugin is disabled according to its restrictions'
        )
        .clickByCssSelector(pluginSelector + 'input[name=attribute_a]')
        .assertElementEnabled(
          pluginSelector + 'input[name=attribute_b]',
          'Attribute B of NIC plugin is enabled'
        )
        .assertElementTextEquals(
          '.property-item-container.plugin_with_node_and_nic_attributes .btn-link',
          'Enabled',
          'NIC plugin is enabled'
        )
        .clickByCssSelector('.btn-revert-changes')
        .then(() => clusterPage.goToTab('Settings'))
        .clickByCssSelector(pluginSelector + '.plugin-versions input[type=radio]:not(:checked)')
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted())
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => node.openNodePopup())
        .clickByCssSelector('#headingattributes')
        .assertElementExists(
          '.setting-section-plugin_section_a_v2',
          'Section A (v2) of node plugin presented in the node pop-up'
        )
        .then(() => modal.close())
        .clickByCssSelector('button.btn-configure-interfaces')
        .assertElementAppears('div.ifc-list', 5000, 'Node interfaces loaded')
        .then(pollUntil(() => window.$('div.ifc-list').is(':visible') || null, 1000))
        .clickByCssSelector(
          '.property-item-container.plugin_with_node_and_nic_attributes .btn-link'
        )
        .assertElementExists(
          pluginSelector + 'input[name=attribute_a_v2]',
          'Attribute A (v2) of NIC plugin presented'
        )
        .clickByCssSelector('.btn-revert-changes')
        .then(() => clusterPage.goToTab('Settings'))
        .clickByCssSelector(pluginSelector + 'h3 input[type=checkbox]')
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted())
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => node.openNodePopup())
        .assertElementNotExists('#headingattributes', 'Node plugin was deactivated')
        .then(() => modal.close())
        .clickByCssSelector('button.btn-configure-interfaces')
        .assertElementAppears('div.ifc-list', 5000, 'Node interfaces loaded')
        .then(pollUntil(() => window.$('div.ifc-list').is(':visible') || null, 1000))
        .assertElementNotExists(pluginSelector, 'NIC plugin was deactivated')
        .then(() => clusterPage.goToTab('Settings'));
    }
  };
});
