"use strict";
/**
 * @module opcua.client
 */

const util = require("util");
const _ = require("underscore");

const EventEmitter = require("events").EventEmitter;
const subscription_service = require("node-opcua-service-subscription");
const read_service = require("node-opcua-service-read");

const assert = require("node-opcua-assert").assert;
const TimestampsToReturn = read_service.TimestampsToReturn;

const ClientMonitoredItemBase = require("./client_monitored_item_base").ClientMonitoredItemBase;

/**
 * ClientMonitoredItemGroup
 * @class ClientMonitoredItemGroup
 * @extends EventEmitter
 *
 * @param subscription              {ClientSubscription}
 * @param itemsToMonitor             {Array<ReadValueId>}
 * @param itemsToMonitor.nodeId      {NodeId}
 * @param itemsToMonitor.attributeId {AttributeId}
 *
 * @param monitoringParameters      {MonitoringParameters}
 * @param timestampsToReturn        {TimestampsToReturn}
 * @constructor
 *
 * event:
 *    "initialized"
 *    "err"
 *    "changed"
 *
 *  note: this.monitoringMode = subscription_service.MonitoringMode.Reporting;
 */
function ClientMonitoredItemGroup(subscription, itemsToMonitor, monitoringParameters, timestampsToReturn) {

    assert(_.isArray(itemsToMonitor));

    timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

    //xx var ClientSubscription = require("./client_subscription").ClientSubscription;
    assert(subscription.constructor.name === "ClientSubscription");

    this.subscription = subscription;

    this.monitoredItems = itemsToMonitor.map(function (itemToMonitor) {
        return new ClientMonitoredItemBase(subscription, itemToMonitor, monitoringParameters);
    });

    this.timestampsToReturn = timestampsToReturn;
    this.monitoringMode = subscription_service.MonitoringMode.Reporting;
}
util.inherits(ClientMonitoredItemGroup, EventEmitter);

ClientMonitoredItemGroup.prototype.toString = function () {

    const self = this;
    let ret = "ClientMonitoredItemGroup : \n";
    ret += "itemsToMonitor:       = [\n " + self.monitoredItems.map(function (monitoredItem) {
        return monitoredItem.itemToMonitor.toString();
    }).join("\n") + "\n];\n";

    ret += "timestampsToReturn:   " + self.timestampsToReturn.toString() + "\n";
    ret += "monitoringMode        " + subscription_service.MonitoringMode[self.monitoringMode];
    return ret;
};

/**
 * remove the MonitoredItem from its subscription
 * @method terminate
 * @param  done {Function} the done callback
 * @async
 */
ClientMonitoredItemGroup.prototype.terminate = function (done) {

    assert(!done || _.isFunction(done));
    const self = this;
    /**
     * Notify the observer that this monitored item has been terminated.
     * @event terminated
     */
    self.emit("terminated");
    self.subscription._delete_monitored_items(self.monitoredItems, function (err) {
        if (done) {
            done(err);
        }
    });
};


/**
 * @method _monitor
 * Creates the monitor item (monitoring mode = Reporting)
 * @param done {Function} callback
 * @private
 */
ClientMonitoredItemGroup.prototype._monitor = function (done) {
    assert(done === undefined || _.isFunction(done));
    const self = this;

    self.monitoredItems.forEach(function (monitoredItem, index) {
        monitoredItem.on("changed", function (dataValue) {
            /**
             * Notify the observers that a group MonitoredItem value has changed on the server side.
             * @event changed
             * @param monitoredItem
             * @param value
             * @param index
             */
            try {
                self.emit("changed", monitoredItem, dataValue, index);
            }
            catch (err) {

                console.log(err);
            }
        });
    });


    ClientMonitoredItemBase._toolbox_monitor(self.subscription, self.timestampsToReturn, self.monitoredItems, function (err) {
        if (err) {
            self.emit("terminated");
        } else {
            self.emit("initialized");
            // set the event handler
        }

        if (done) {
            done(err);
        }
    });
};

/**
 * @method modify
 * @param parameters {Object}
 * @param [timestampsToReturn=null] {TimestampsToReturn}
 * @param callback {Function}
 */
ClientMonitoredItemGroup.prototype.modify = function (parameters, timestampsToReturn, callback) {
    const self = this;
    self.timestampsToReturn = timestampsToReturn || self.timestampsToReturn;
    ClientMonitoredItemBase._toolbox_modify(self.subscription, self.monitoredItems, parameters, self.timestampsToReturn, callback);
};

ClientMonitoredItemGroup.prototype.setMonitoringMode = function (monitoringMode, callback) {
    const self = this;
    ClientMonitoredItemBase._toolbox_setMonitoringMode(self.subscription, self.monitoredItems, monitoringMode, callback);
};

exports.ClientMonitoredItemGroup = ClientMonitoredItemGroup;
