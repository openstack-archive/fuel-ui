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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  'use strict';

  registerSuite(function() {
    var common, modal;

    return {
      name: 'Wizard Page',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test compatible ceph, incompatible tun+vmware, requires sahara': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842451

        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Check that smile is disabled when vCenter is enabled
          .clickByCssSelector('input[value=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .assertElementDisabled('input[value=additional_service\\:smile]',
                                 'Smile checkbox is enabled with vCenter')

          .clickByCssSelector('button.prev-pane-btn') // back to Storage
          .clickByCssSelector('button.prev-pane-btn') // Networking
          .clickByCssSelector('button.prev-pane-btn') // Compute
          .clickByCssSelector('input[value=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // Networking

          // Check that smile is disabled when Neutron with tunneling segmentation is enabled
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:vlan]')
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:tun]')
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .assertElementDisabled('input[value=additional_service\\:smile]',
                                 'Smile checkbox is enabled with tunneling segmentation')

          .clickByCssSelector('button.prev-pane-btn') // back to Storage
          .clickByCssSelector('button.prev-pane-btn') // Networking

          // Create cluster with VLAN + Ceph Block Storage + Sahara + smile
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:tun]')
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:vlan]')
          .pressKeys('\uE007')  // Storage
          .clickByCssSelector('input[value=storage\\:block\\:ceph]')
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .clickByCssSelector('input[value=additional_service\\:smile]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(50);
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
