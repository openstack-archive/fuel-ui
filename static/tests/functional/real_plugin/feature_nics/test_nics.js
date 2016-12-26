/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

define([
  'intern!object',
  'tests/functional/helpers',
  'tests/functional/real_plugin/plugin_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal',
  'tests/functional/pages/cluster'
], function(registerSuite, helpers, pluginHelpers, Common, Modal, ClusterPage) {
  'use strict';

  registerSuite(function() {
    var common, modal, clusterPage;

    var attrLabelPlugin1 = 'span.fuel_plugin_example_v5';
    var attrLabelPlugin2 = 'span.fuel-plugin-vmware-dvs';

    var nicCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
    var nicText = 'input[type="text"][name="attribute_text"]';

    var itfConfigure = 'button.btn-configure-interfaces';

    return {
      name: 'NICs',
      timeout: 4 * 60 * 1000,
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        clusterPage = new ClusterPage(this.remote);

        return this.remote
         .then(function() {
           return common.getIn();
         });
      },
      afterEach: function() {
        return this.remote
          .deleteCluster(modal);
      },
      'Set up all attributes': function() {
        return this.remote
         .updatePlugin('update_nics nic_setup')
         .updatePlugin('update_nodes node_setup')
         .updatePlugin('update_bonds bond_setup')

         .newClusterWithPlugin(modal);
      },
      'Test attributes for NIC interfaces': function() {
        return this.remote
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration,
          // verify that plugin's attributes for nics are presented
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)
          .assertAmountMatches(attrLabelPlugin1, 'span.mtu', 'Amount of plugin\'s ' +
                               'attributes does not match with interfaces amount')

          // Expand attributes of the first interface, verify that checkbox and input are available
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(nicCheckbox)
          .assertElementTextEquals(attrLabelPlugin1 + '.active button', 'Enabled',
                                   'Checkbox does not enable plugin section')
          .assertElementEnabled(nicText, 'Text-input is not available to edit')
          .setInputValue(nicText, 'some_data')

          // Save changes
          .applyItfChanges();
      },
      'Test Load defaults attributes for NIC': function() {
        return this.remote
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Expand attributes of the first interface, enable checkbox
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(nicCheckbox)

          // Expand attributes of the second interface, input some text
          .expandNICPropertyByIndex(attrLabelPlugin1, 1)
          .setInputValue('.ifc-list > div:nth-child(2) ' + nicText, 'some_data')

          // Save changes
          .applyItfChanges()

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Verify that defaults were loaded
          .assertInputValueEquals('.ifc-list > div:nth-child(2) ' + nicText, '',
                                  'Text-input is not empty')
          .assertElementsExist(nicCheckbox + ':not(:checked)', 2, 'Checkboxes are still checked')

          // Save with default values
          .applyItfChanges();
      },
      'Test cluster without plugin has only core attributes': function() {
        return this.remote
          // Create cluster without plugin
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', 'Temp')
          .pressKeys('\uE007') // go to Compute
          .pressKeys('\uE007') // Networking
          .pressKeys('\uE007') // Storage
          .pressKeys('\uE007') // Additional Services
          .pressKeys('\uE007') // Finish
          .pressKeys('\uE007') // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Enable KVM
          .then(function() {
            return clusterPage.goToTab('Settings');
          })
          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')
          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Add one node, verify that NICs plugin attributes are not presented
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)
          .assertElementNotExists(attrLabelPlugin1, 'NICs attributes are presented')

          // Verify that plugin attributes are not presented after bonding
          .bondInterfaces(-1, -2)
          .assertElementNotExists(attrLabelPlugin1, 'Bonds attributes are presented')
          .applyItfChanges()

          // Verify that nodes plugin attributes are not presented
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector('.node-settings')
          .then(function() {
            return modal.waitToOpen();
          })
          .clickByCssSelector('#headingattributes')

          .assertElementNotExists('.setting-section-plugin_section_a',
                                  'Plugin section is presented')
          .assertElementNotExists(nicCheckbox, 'Checkbox is presented')
          .assertElementNotExists(nicText, 'Input field is presented')

          .then(function() {
            return modal.close();
          })
          .then(function() {
            return modal.waitToClose();
          });
      },
      'Test that NIC config may be changed for several nodes simultaneously': function() {
        return this.remote
          .newClusterWithPlugin(modal)

          // Add two nodes, change NIC attributes for the first node
          .then(function() {
            return common.addNodesToCluster(2, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .setInputValue('.ifc-list > div:nth-child(1) ' + nicText, '1')
          .applyItfChanges()

          // Change NIC attributes for the second node
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .selectNodeByIndex(0)
          .selectNodeByIndex(1)
          .clickByCssSelector(itfConfigure)
          .expandNICPropertyByIndex(attrLabelPlugin1, 1)
          .setInputValue('.ifc-list > div:nth-child(2) ' + nicText, '2')
          .applyItfChanges()

          // Select both nodes, Configure interfaces, save changes
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .expandNICPropertyByIndex(attrLabelPlugin1, 1)
          .assertInputValueEquals('.ifc-list > div:nth-child(1) ' + nicText, '1',
                                  'Text-input is empty')
          .assertInputValueEquals('.ifc-list > div:nth-child(2) ' + nicText, '',
                                  'Text-input is not empty')

          .applyItfChanges();
      },
      'Test several plugins with different attributes for NIC': function() {
        var nicCheckboxDVS = 'input[type="checkbox"][name="attribute_checkbox_b"]';
        var nicTextItf1 = '.ifc-list > div:nth-child(1) ' + nicText;

        return this.remote
          // Create cluster with plugins
          .newClusterFillName(modal)
          .pressKeys('\uE007') // go to Compute
          .clickByCssSelector('input[name="hypervisor:vmware"]')
          .pressKeys('\uE007') // Networking
          .clickByCssSelector('input[name="network:neutron:ml2:dvs"]')
          .pressKeys('\uE007') // Storage
          .pressKeys('\uE007') // Additional Services
          .clickByCssSelector('input[name="additional_service:service_plugin_v5_component"]')
          .pressKeys('\uE007') // Finish
          .pressKeys('\uE007') // Create
          .then(function() {
            return modal.waitToClose();
          })

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Verify that attributes provided by both of plugins are presented and can be changed
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)

          .setInputValue(nicTextItf1, 'some_data')

          .assertElementEnabled(nicCheckbox, 'Checkbox is disabled')
          .clickByCssSelector(nicCheckbox)

          .assertInputValueEquals(nicTextItf1, 'some_data', 'Text-input is empty')

          .expandNICPropertyByIndex(attrLabelPlugin2, 0)

          .assertElementEnabled(nicCheckboxDVS, 'DVS Checkbox is disabled')
          .clickByCssSelector(nicCheckboxDVS)

          .assertElementExists(nicCheckboxDVS + ':checked', 'DVS Checkbox was not checked')

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)

          .assertElementExists(nicCheckbox + ':checked', 'Checkbox was not checked')

          .applyItfChanges()

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Verify that defaults were loaded
          .assertInputValueEquals(nicTextItf1, '', 'Text-input is not empty')
          .assertElementExists(nicCheckbox + ':not(:checked)', 'Checkbox is still checked')

          .expandNICPropertyByIndex(attrLabelPlugin2, 0)
          .assertElementExists(nicCheckboxDVS + ':not(:checked)', 'DVS Checkbox is still checked')

          // Cancel changes
          .clickByCssSelector('button.btn-revert-changes')
          .waitForCssSelector('.btn-revert-changes:disabled', 1000)

          // Verify that saved values loaded
          .assertElementExists(nicCheckboxDVS + ':checked', 'DVS Checkbox is not checked')

          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertInputValueEquals(nicTextItf1, 'some_data', 'Text-input is empty')
          .assertElementExists(nicCheckbox + ':checked', 'Checkbox is not checked')

          // Load defaults
          .clickByCssSelector('button.btn-defaults')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)

          // Save with default values
          .applyItfChanges();
      },
      'Test restrictions': function() {
        var nicText = 'input[type="text"][name="attribute_text_r"]';

        return this.remote
          .updatePlugin('update_nics nic_restrict')
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Expand attributes of the first interface, verify that checkbox is available
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .clickByCssSelector(nicCheckbox)

          // Verify that text input is not displayed
          .assertElementNotExists(nicText, 'Text-input field is displayed')

          // Enable KVM
          .clickByCssSelector('a.settings.cluster-tab')
          .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
          .then(function() {
            return modal.waitToClose();
          })

          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Verify that text input is displayed
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector(itfConfigure)
          .expandNICPropertyByIndex(attrLabelPlugin1, 0)
          .assertElementExists(nicCheckbox, 'Checkbox is not displayed')
          .assertElementExists(nicText, 'Text-input field is not displayed');
      }
    };
  });
});
