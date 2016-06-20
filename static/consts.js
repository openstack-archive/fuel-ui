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

export const NODE_STATUSES = [
  'ready',
  'pending_addition',
  'pending_deletion',
  'provisioned',
  'provisioning',
  'deploying',
  'stopped',
  'discover',
  'error',
  'offline',
  'removing'
];

export const NODE_LIST_SORTERS = [
  'cluster',
  'roles',
  'status',
  'name',
  'mac',
  'ip',
  'manufacturer',
  'cores',
  'ht_cores',
  'hdd',
  'disks',
  'ram',
  'interfaces',
  'group_id'
];

export const NODE_LIST_FILTERS = [
  'cluster',
  'roles',
  'status',
  'manufacturer',
  'cores',
  'ht_cores',
  'hdd',
  'disks_amount',
  'ram',
  'interfaces',
  'group_id'
];

export const NODE_VIEW_MODES = [
  'standard',
  'compact'
];

export const DEPLOYMENT_TASK_STATUSES = [
  'pending',
  'running',
  'ready',
  'error',
  'skipped'
];
