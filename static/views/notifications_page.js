/*
 * Copyright 2014 Mirantis, Inc.
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
import React from 'react';
import utils from 'utils';
import models from 'models';
import {ShowNodeInfoDialog} from 'views/dialogs';
import {backboneMixin, loadPropsMixin} from 'component_mixins';

var NotificationsPage, Notification;

NotificationsPage = React.createClass({
  mixins: [
    backboneMixin('notifications'),
    loadPropsMixin
  ],
  statics: {
    title: i18n('notifications_page.title'),
    breadcrumbsPath: [['home', '/'], 'notifications'],
    fetchData() {
      var notifications = app.notifications;
      return notifications.fetch()
        .then(() => ({notifications}));
    }
  },
  checkDateIsToday(date) {
    var today = new Date();
    var day = _.padStart(today.getDate(), 2, '0');
    var month = _.padStart(today.getMonth() + 1, 2, '0');
    return [day, month, today.getFullYear()].join('-') === date;
  },
  render() {
    var notificationGroups = this.props.notifications.groupBy('date');
    return (
      <div className='notifications-page'>
        <div className='page-title'>
          <h1 className='title'>{i18n('notifications_page.title')}</h1>
        </div>
        <div className='content-box'>
          {_.map(notificationGroups, (notifications, date) => {
            return (
              <div className='row notification-group' key={date}>
                <div className='title col-xs-12'>
                  {this.checkDateIsToday(date) ? i18n('notifications_page.today') : date}
                </div>
                {_.map(notifications, (notification) => {
                  return <Notification
                    key={notification.id}
                    notification={notification}
                  />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
});

Notification = React.createClass({
  mixins: [backboneMixin('notification')],
  showNodeInfo(id) {
    var node = new models.Node({id});
    node.fetch();
    ShowNodeInfoDialog.show({node});
  },
  markAsRead() {
    var {notification} = this.props;
    notification.toJSON = () => notification.pick('id', 'status');
    notification.save({status: 'read'});
  },
  onNotificationClick() {
    var {notification} = this.props;
    if (notification.get('status') === 'unread') this.markAsRead();
    if (notification.get('node_id')) this.showNodeInfo(notification.get('node_id'));
  },
  render() {
    var {notification} = this.props;
    var iconClass = {
      error: 'glyphicon-exclamation-sign text-danger',
      warning: 'glyphicon-warning-sign text-warning',
      discover: 'glyphicon-bell'
    }[notification.get('topic')] || 'glyphicon-info-sign';

    return (
      <div
        className={utils.classNames('col-xs-12 notification', notification.get('status'))}
        onClick={this.onNotificationClick}
      >
        <div className='notification-time'>
          {notification.get('time')}
        </div>
        <div className='notification-type'>
          <i className={utils.classNames('glyphicon', iconClass)} />
        </div>
        <div className='notification-message'>
          <span
            className={utils.classNames({'btn btn-link': notification.get('node_id')})}
            dangerouslySetInnerHTML={{__html: utils.urlify(notification.escape('message'))}}
          />
        </div>
      </div>
    );
  }
});

export default NotificationsPage;
