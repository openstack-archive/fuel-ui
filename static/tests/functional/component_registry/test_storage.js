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
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/component_registry/component_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, component_helpers, Common, Modal) {
  'use strict';

  registerSuite(function() {
    var common, modal;

    return {
      name: 'Storage',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
         .then(function() {
              return common.getIn();
         });
      },
      'Test storage, -object': function() {
        var nfs = 'input[value=storage\\:block\\:nfs]';
        var cat = 'input[value=storage\\:object\\:cat]';
        var sheepdog = 'input[value=storage\\:object\\:sheepdog]';

        return this.remote
          .updatePlugin('dvs_default test_storage_block_nfs')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that cat and sheepdog are disabled when nfs is enabled
          .clickByCssSelector(nfs)
          .assertElementDisabled(cat, 'Cat checkbox is enabled with nfs')
          .assertElementDisabled(sheepdog, 'Sheepdog checkbox is enabled with nfs')
          .assertElementsExist('i.tooltip-icon.glyphicon-warning-sign' +
                               '[data-original-title="Not compatible with nfs"]', 2,
                               'No warnings that cat and sheepdog are incompatible with nfs')

          // Check that nfs is disabled when cat and sheepdog are enabled
          .clickByCssSelector(nfs)
          .clickByCssSelector(cat)
          .assertElementDisabled(nfs, 'Nfs checkbox is enabled with cat')
          .assertElementsExist('i.tooltip-icon.glyphicon-warning-sign' +
                               '[data-original-title="not compatible with cat"]', 1,
                               'No warning that nfs is incompatible with cat')
          .clickByCssSelector(sheepdog)
          .assertElementDisabled(nfs, 'Nfs checkbox is enabled with sheepdog')
          .clickByCssSelector(cat)
          .assertElementsExist('i.tooltip-icon.glyphicon-warning-sign' +
                               '[data-original-title="not compatible with sheepdog"]', 1,
                               'No warning that nfs is incompatible with sheepdog')
          .clickByCssSelector(sheepdog)

          // Create cluster with nfs Block Storage
          .clickByCssSelector(nfs)
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
              return modal.waitToClose();
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      },
      'Test storage -storage:image': function() {
        var nfs = 'input[value=storage\\:image\\:nfs]';
        var zfs = 'input[value=storage\\:block\\:zfs]';

        return this.remote
          .updatePlugin('dvs_default test_storage_block_zfs')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that zfs block storage is disabled when nfs image storage enabled
          .clickByCssSelector(nfs)
          .assertElementDisabled(zfs, 'Zfs checkbox is enabled with nfs')

          // Check that nfs image storage is disabled when zfs block storage enabled
          .clickByCssSelector(nfs)  // disable nfs
          .clickByCssSelector(zfs)
          .assertElementDisabled(nfs, 'Nfs checkbox is enabled with zfs')
          .assertElementsExist('i.tooltip-icon.glyphicon-warning-sign' +
                               '[data-original-title="Not compatible with zfs"]', 1,
                               'No message that nfs is not compatible with zfs')

          // Create cluster with zfs
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
              return modal.waitToClose();
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      },
      'Test storage:image, -image:ceph': function() {
        var swift = 'input[value=storage\\:image\\:swift]';
        var ceph = 'input[value=storage\\:image\\:ceph]';

        return this.remote
          .updatePlugin('dvs_default test_storage_image_swift')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that Ceph image storage is inactive when swift image storage is
          // active and vice versa
          .clickByCssSelector(swift)
          .assertElementPropertyEquals(ceph, 'checked', false, 'Ceph is enabled with swift')
          .clickByCssSelector(ceph)
          .assertElementPropertyEquals(swift, 'checked', false, 'Swift is enabled with ceph')

          // Close wizard
          .clickByCssSelector('button.close');
      },
      'Test storage:image, -image:ceph, +storage:image': function() {
        var ceph = 'input[value=storage\\:image\\:ceph]';
        var swift = 'input[value=storage\\:image\\:swift]';

        return this.remote
          .updatePlugin('dvs_default test_storage_image_swift_cat')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that Ceph image storage is inactive when swift image storage is
          // active and vice versa
          .clickByCssSelector('input[value=storage\\:image\\:cat]')
          .clickByCssSelector(ceph)
          .assertElementDisabled(swift, 'Swift is enabled with ceph')
          .clickByCssSelector(ceph)  // disable Ceph
          .clickByCssSelector(swift)
          .assertElementDisabled(ceph, 'Ceph is enabled with swift')
          .assertElementsExist('i.tooltip-icon.glyphicon-warning-sign' +
                               '[data-original-title="Not compatible with swift"]', 1,
                               'No warning that ceph is not compatible with swift')

          // Create cluster with qemu + Neutron vlan + Swift + cat
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
              return modal.waitToClose();
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      },
      'Test storage:object, -block:lvm': function() {
        var cat = 'input[value=storage\\:object\\:cat]';

        return this.remote
          .updatePlugin('dvs_default test_storage_object_cat')
          .newClusterFillName(modal)

          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that cat is disabled when LVM is enabled (by default)
          .assertElementDisabled(cat, 'cat is enabled with LVM')

          // Create cluster with Ceph block storage + Stor ceph
          .clickByCssSelector('input[value=storage\\:block\\:ceph]')
          .clickByCssSelector(cat)
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
              return modal.waitToClose();
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
