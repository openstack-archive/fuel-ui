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
  registerSuite(function() {
    var common, modal;

    return {
      name: 'C842463',
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
      'Test network, -tun, -e:ceph, !Sahara, !ml2, +dvs, +b:ceph, +qemu, +Murano': function() {
        var vmware = 'input[value=hypervisor\\:vmware]';
        var xen = 'input[value=hypervisor\\:xen]';
        var vlan = 'input[value=network\\:neutron\\:ml2\\:vlan]';
        var tun = 'input[value=network\\:neutron\\:ml2\\:tun]';
        var frog = 'input[value=network\\:neutron\\:ml2\\:frog]';

        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Check that xen is incompatible with vCenter
          .clickByCssSelector(vmware)
          .assertElementDisabled(xen, 'Xen is enabled with vCenter')
          .clickByCssSelector(vmware)
          .clickByCssSelector(xen)
          .assertElementDisabled(vmware, 'vCenter is enabled with xen')
          .clickByCssSelector(xen)

          // Check that frog is disabled with ml2:tun
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector(vlan)
          .clickByCssSelector(tun)
          .assertElementDisabled(frog, 'frog is enabled with tun')
          .clickByCssSelector(tun)
          .clickByCssSelector(vlan)

          // Create cluster with KVM + vCenter, frog + DVS network, Sahara + Murano
          .clickByCssSelector('button.prev-pane-btn')  // back to Compute
          .clickByCssSelector(vmware)
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
          .clickByCssSelector(frog)
          .pressKeys('\uE007')  // Storage
          .assertElementDisabled('input[value=storage\\:ephemeral\\:ceph]',
                                 'Ephemerap Ceph is enabled with frog')
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:sahara]')
          .clickByCssSelector('input[value=additional_service\\:murano]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(100);
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      },
      'Test create cluster without required Sahara': function() {
        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Try to create cluster with KVM + vCenter hypervisors, frog + DVS network
          // without Sahara additional service (should not be created)
          .clickByCssSelector('input[value=hypervisor\\:vmware]')
          .pressKeys('\uE007')  // Networking
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:frog]')
          .clickByCssSelector('input[value=network\\:neutron\\:ml2\\:dvs]')
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(100);
          })
          .assertElementTextEquals('.text-error', 'Requires [u\'additional_service:sahara\'] for ' +
                                   '\'network:neutron:ml2:frog\' components were not satisfied.',
                                   'Error were not displayed')
          .then(function() {
            return modal.close();
          });
      }
    };
  });
});
