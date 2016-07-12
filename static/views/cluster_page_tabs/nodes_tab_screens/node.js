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
import _ from 'underscore';
import i18n from 'i18n';
import Backbone from 'backbone';
import React from 'react';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {Input, Popover, Tooltip, Link} from 'views/controls';
import {DeleteNodesDialog, RemoveOfflineNodeDialog, ShowNodeInfoDialog} from 'views/dialogs';
import {renamingMixin} from 'component_mixins';

var Node = React.createClass({
  mixins: [renamingMixin('name')],
  getInitialState() {
    return {
      actionInProgress: false,
      extendedView: false,
      labelsPopoverVisible: false
    };
  },
  componentDidUpdate() {
    if (!this.props.node.get('cluster') && !this.props.checked) {
      this.props.node.set({pending_roles: []}, {assign: true});
    }
  },
  getNodeLogsLink() {
    var status = this.props.node.get('status');
    var error = this.props.node.get('error_type');
    var options = {type: 'remote', node: this.props.node.id};
    if (status === 'discover') {
      options.source = 'bootstrap/messages';
    } else if (
      status === 'provisioning' ||
      status === 'provisioned' ||
      (status === 'error' && error === 'provision')
    ) {
      options.source = 'install/fuel-agent';
    } else if (
      status === 'deploying' ||
      status === 'ready' ||
      (status === 'error' && error === 'deploy')
    ) {
      options.source = 'install/puppet';
    }
    return '/cluster/' + this.props.node.get('cluster') + '/logs/' +
      utils.serializeTabOptions(options);
  },
  applyNewNodeName(newName) {
    if (newName && newName !== this.props.node.get('name')) {
      this.setState({actionInProgress: true});
      this.props.node.save({name: newName}, {patch: true, wait: true})
        .then(this.endRenaming, this.endRenaming);
    } else {
      this.endRenaming();
    }
  },
  onNodeNameInputKeydown(e) {
    if (e.key === 'Enter') {
      this.applyNewNodeName(this.refs.name.getInputDOMNode().value);
    } else if (e.key === 'Escape') {
      this.endRenaming();
    }
  },
  discardNodeDeletion(e) {
    e.preventDefault();
    if (this.state.actionInProgress) return;
    this.setState({actionInProgress: true});
    new models.Node(this.props.node.attributes)
      .save({pending_deletion: false}, {patch: true})
      .then(
        () => this.props.cluster.fetchRelated('nodes'),
        (response) => {
          utils.showErrorDialog({
            title: i18n('cluster_page.nodes_tab.node.cant_discard'),
            response: response
          });
        }
      )
      .then(() => {
        this.setState({actionInProgress: false});
      });
  },
  removeNode(e) {
    e.preventDefault();
    if (this.props.viewMode === 'compact') this.toggleExtendedNodePanel();
    RemoveOfflineNodeDialog
      .show()
      .then(() => {
        // sync('delete') is used instead of node.destroy() because we want
        // to keep showing the 'Removing' status until the node is truly removed
        // Otherwise this node would disappear and might reappear again upon
        // cluster nodes refetch with status 'Removing' which would look ugly
        // to the end user
        return Backbone
          .sync('delete', this.props.node)
          .then(
            (task) => {
              dispatcher.trigger('networkConfigurationUpdated updateNodeStats ' +
                'updateNotifications labelsConfigurationUpdated');
              if (task.status === 'ready') {
                // Do not send the 'DELETE' request again, just get rid
                // of this node.
                this.props.node.trigger('destroy', this.props.node);
                return;
              }
              if (this.props.cluster) {
                this.props.cluster.get('tasks').add(new models.Task(task), {parse: true});
              }
              this.props.node.set('status', 'removing');
            },
            (response) => {
              utils.showErrorDialog({response: response});
            }
          );
      });
  },
  showNodeDetails(e) {
    e.preventDefault();
    if (this.state.extendedView) this.toggleExtendedNodePanel();
    ShowNodeInfoDialog.show({
      node: this.props.node,
      cluster: this.props.cluster,
      nodeNetworkGroup: this.props.nodeNetworkGroups.get(this.props.node.get('group_id')),
      renderActionButtons: this.props.renderActionButtons
    });
  },
  toggleExtendedNodePanel(e) {
    if (e) e.stopPropagation();
    var states = this.state.extendedView ?
      {extendedView: false, isRenaming: false} : {extendedView: true};
    this.setState(states);
  },
  renderNameControl() {
    if (this.state.isRenaming) {
      return (
        <Input
          ref='name'
          type='text'
          name='node-name'
          defaultValue={this.props.node.get('name')}
          inputClassName='form-control node-name-input'
          disabled={this.state.actionInProgress}
          onKeyDown={this.onNodeNameInputKeydown}
          maxLength='100'
          selectOnFocus
          autoFocus
        />
      );
    }
    return (
      <Tooltip text={i18n('cluster_page.nodes_tab.node.edit_name')}>
        <p onClick={!this.state.actionInProgress && this.startRenaming}>
          {this.props.node.get('name') || this.props.node.get('mac')}
        </p>
      </Tooltip>
    );
  },
  renderNodeHardwareSummary() {
    var htCores = this.props.node.resource('ht_cores');
    var hdd = this.props.node.resource('hdd');
    var ram = this.props.node.resource('ram');
    return (
      <div className='node-hardware'>
        <span>
          {i18n('node_details.cpu')}
          {': '}
          {this.props.node.resource('cores') || '0'} ({_.isUndefined(htCores) ? '?' : htCores})
        </span>
        <span>
          {i18n('node_details.ram')}
          {': '}
          {_.isUndefined(ram) ? '?' + i18n('common.size.gb') : utils.showSize(ram)}
        </span>
        <span>
          {i18n('node_details.hdd')}
          {': '}
          {_.isUndefined(hdd) ? '?' + i18n('common.size.gb') : utils.showSize(hdd)}
        </span>
      </div>
    );
  },
  renderNodeCheckbox() {
    return (
      <Input
        type='checkbox'
        name={this.props.node.id}
        checked={!!this.props.checked}
        disabled={
          this.props.locked ||
          !this.props.node.isSelectable() ||
          this.props.mode === 'edit'
        }
        onChange={this.props.mode !== 'edit' ? this.props.onNodeSelection : _.noop}
        wrapperClassName='pull-left'
      />
    );
  },
  renderRoleList(roles) {
    return (
      <ul>
        {_.map(roles, (role) => {
          return (
            <li
              key={this.props.node.id + role}
              className={utils.classNames({'text-success': !this.props.node.get('roles').length})}
            >
              {role}
            </li>
          );
        })}
      </ul>
    );
  },
  showDeleteNodesDialog(e) {
    e.preventDefault();
    if (this.props.viewMode === 'compact') this.toggleExtendedNodePanel();
    DeleteNodesDialog
      .show({
        nodes: new models.Nodes(this.props.node),
        cluster: this.props.cluster
      })
      .then(this.props.onNodeSelection);
  },
  renderLabels() {
    var labels = this.props.node.get('labels');
    if (_.isEmpty(labels)) return null;
    return (
      <ul>
        {_.map(_.keys(labels).sort(_.partialRight(utils.natsort, {insensitive: true})), (key) => {
          var value = labels[key];
          return (
            <li key={key + value} className='label'>
              {key + (_.isNull(value) ? '' : ' "' + value + '"')}
            </li>
          );
        })}
      </ul>
    );
  },
  renderExtendedView(options) {
    var {node, locked, renderActionButtons} = this.props;
    var {ns, roles, logoClasses} = options;

    return (
      <Popover className='node-popover' toggle={this.toggleExtendedNodePanel}>
        <div>
          <div className='node-name clearfix'>
            {this.renderNodeCheckbox()}
            <div className='name pull-left'>
              {this.props.nodeActionsAvailable ?
                this.renderNameControl()
              :
                <div>{node.get('name') || node.get('mac')}</div>
              }
            </div>
          </div>
          <div className='node-stats'>
            {!!roles.length &&
              <div className='role-list'>
                <i className='glyphicon glyphicon-pushpin' />
                {this.renderRoleList(roles)}
              </div>
            }
            {!_.isEmpty(node.get('labels')) &&
              <div className='node-labels'>
                <i className='glyphicon glyphicon-tags pull-left' />
                {this.renderLabels()}
              </div>
            }
            <div className='node-status-block clearfix'>
              <i className='glyphicon glyphicon-time' />
              {this.renderStatusBlock()}
            </div>
            {this.props.nodeActionsAvailable &&
              <div className='node-buttons'>
                {!!node.get('cluster') &&
                  <Link className='btn btn-view-logs' to={this.getNodeLogsLink()} >
                    {i18n('cluster_page.nodes_tab.node.view_logs')}
                  </Link>
                }
                {renderActionButtons &&
                  (node.get('pending_addition') || node.get('pending_deletion')) &&
                  !locked &&
                  <button
                    className='btn btn-discard'
                    key='btn-discard'
                    onClick={node.get('pending_deletion') ?
                      this.discardNodeDeletion
                    :
                      this.showDeleteNodesDialog
                    }
                  >
                    {i18n(ns + (node.get('pending_deletion') ?
                      'discard_deletion'
                    :
                      'delete_node'
                    ))}
                  </button>
                }
              </div>
            }
          </div>
          <div className='hardware-info clearfix'>
            <div className={utils.classNames(logoClasses)} />
            {this.renderNodeHardwareSummary()}
          </div>
          {this.props.nodeActionsAvailable &&
            <div className='node-popover-buttons'>
              <button className='btn btn-default node-settings' onClick={this.showNodeDetails}>
                {i18n(ns + 'details')}
              </button>
            </div>
          }
        </div>
      </Popover>
    );
  },
  renderCompactNode(options) {
    var {node, checked, onNodeSelection} = this.props;
    var {nodePanelClasses, isSelectable} = options;

    return (
      <div className='compact-node'>
        <div className={utils.classNames(nodePanelClasses)}>
          <label
            className='node-box'
            onClick={isSelectable && _.partial(onNodeSelection, null, !checked)}
          >
            <div>
              {checked &&
                <div className='node-checkbox'>
                  <i className='glyphicon glyphicon-ok' />
                </div>
              }
              <div className='node-name'>
                <p>{node.get('name') || node.get('mac')}</p>
              </div>
            </div>
            <div className='node-hardware'>
              <span>
                {node.resource('cores')} ({node.resource('ht_cores') || '?'})
              </span> / <span>
                {node.resource('hdd') ? utils.showSize(node.resource('hdd')) : '?' +
                  i18n('common.size.gb')
                }
              </span> / <span>
                {node.resource('ram') ? utils.showSize(node.resource('ram')) : '?' +
                  i18n('common.size.gb')
                }
              </span>
            </div>
            <div>
              {this.renderStatusBlock(true)}
              <div className='node-settings' onClick={this.toggleExtendedNodePanel} />
            </div>
          </label>
        </div>
        {this.state.extendedView && this.renderExtendedView(options)}
      </div>
    );
  },
  renderStatusBlock(isCompactView = false) {
    var {node, cluster} = this.props;
    var statusNs = 'cluster_page.nodes_tab.node.status.';
    var status = node.getStatus();
    var statusLabel = i18n(statusNs + status, {
      os: cluster && cluster.get('release').get('operating_system') || 'OS'
    });

    // show provsioning/deployment progress bar
    if (_.includes(['provisioning', 'deploying'], status)) {
      return (
        <div className='node-status'>
          <div>
            <div className='progress'>
              {!isCompactView &&
                <div className='progress-bar-title'>
                  <span>{statusLabel + ': ' + node.get('progress') + '%'}</span>
                </div>
              }
              <div
                className='progress-bar'
                style={{width: _.max([node.get('progress'), 3]) + '%'}}
              />
            </div>
          </div>
        </div>
      );
    }

    // show both status and pending addition/deletion flags
    return (
      <div className='node-status'>
        <div>
          <div>
            <span className={utils.classNames({'text-danger': status === 'error'})}>
              {statusLabel}
            </span>
            {!isCompactView && status === 'offline' &&
              <button onClick={this.removeNode} className='btn node-remove-button'>
                {i18n('cluster_page.nodes_tab.node.remove')}
              </button>
            }
          </div>
          {node.get('pending_addition') &&
            <div className='text-success'>{i18n(statusNs + 'pending_addition')}</div>
          }
          {node.get('pending_deletion') &&
            <div className='text-warning'>{i18n(statusNs + 'pending_deletion')}</div>
          }
        </div>
      </div>
    );
  },
  renderStandardNode(options) {
    var {node, locked, renderActionButtons} = this.props;
    var {ns, roles, nodePanelClasses, logoClasses} = options;
    return (
      <div className={utils.classNames(nodePanelClasses)}>
        <label className='node-box'>
          {this.renderNodeCheckbox()}
          <div className={utils.classNames(logoClasses)} />
          <div className='node-name'>
            <div className='name'>
              {this.props.nodeActionsAvailable ?
                this.renderNameControl()
              :
                <p>{node.get('name') || node.get('mac')}</p>
              }
            </div>
            <div className='role-list'>
              {this.renderRoleList(roles)}
            </div>
          </div>
          <div className='node-labels'>
            {!_.isEmpty(node.get('labels')) &&
              <button className='btn btn-link' onClick={this.toggleLabelsPopover}>
                <i className='glyphicon glyphicon-tag-alt' />
                <div className='sticker'>{_.keys(node.get('labels')).length}</div>
              </button>
            }
            {this.state.labelsPopoverVisible &&
              <Popover className='node-labels-popover' toggle={this.toggleLabelsPopover}>
                {this.renderLabels()}
              </Popover>
            }
          </div>
          <div className='node-action'>
            {this.props.nodeActionsAvailable && [
              !!node.get('cluster') &&
                <Tooltip wrap key='logs' text={i18n(ns + 'view_logs')}>
                  <Link className='btn-view-logs icon icon-logs' to={this.getNodeLogsLink()} />
                </Tooltip>,
              renderActionButtons &&
                (node.get('pending_addition') || node.get('pending_deletion')) &&
                !locked &&
                <Tooltip
                  wrap
                  key={'discard-node-changes-' + node.id}
                  text={i18n(ns +
                    (node.get('pending_deletion') ? 'discard_deletion' : 'delete_node')
                  )}
                >
                  <div
                    className='icon btn-discard'
                    onClick={node.get('pending_deletion') ?
                      this.discardNodeDeletion
                    :
                      this.showDeleteNodesDialog
                    }
                  />
                </Tooltip>
            ]}
          </div>
          {this.renderStatusBlock()}
          {this.renderNodeHardwareSummary()}
          {this.props.nodeActionsAvailable &&
            <div className='node-settings' onClick={this.showNodeDetails} />
          }
        </label>
      </div>
    );
  },
  toggleLabelsPopover(visible) {
    this.setState({
      labelsPopoverVisible: _.isBoolean(visible) ? visible : !this.state.labelsPopoverVisible
    });
  },
  render() {
    var {node, locked, mode, cluster, checked, viewMode} = this.props;
    var ns = 'cluster_page.nodes_tab.node.';
    var isSelectable = node.isSelectable() && !locked && mode !== 'edit';
    var roles = cluster ? node.sortedRoles(cluster.get('roles').map('name')) : [];

    var nodePanelClasses = {
      node: true,
      [node.getStatus()]: true,
      selected: checked,
      'col-xs-12': viewMode !== 'compact',
      unavailable: !isSelectable,
      pending_addition: node.get('pending_addition'),
      pending_deletion: node.get('pending_deletion')
    };

    var manufacturer = node.get('manufacturer') || '';
    var logoClasses = {
      'manufacturer-logo': true,
      [manufacturer.toLowerCase()]: !!manufacturer
    };

    return (viewMode === 'compact' ? this.renderCompactNode : this.renderStandardNode)({
      ns, roles, nodePanelClasses, logoClasses, isSelectable
    });
  }
});

export default Node;
