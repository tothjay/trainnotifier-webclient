﻿/// <reference path="jquery-1.9.1.js" />
/// <reference path="knockout-2.2.1.js" />
/// <reference path="ViewModels.js" />
/// <reference path="moment.js" />

var data = ko.observableArray();
var title = {
    ts: ko.observable(),
    next: ko.observable(65)
};
var timerIntervalId;

$(function () {
    ko.applyBindings(data, $("#ppmTable").get(0));
    ko.applyBindings(data, $("#commandOptions").get(0));
    ko.applyBindings(title, $("#title").get(0));

    getPPMSectors();

    setInterval(function () {
        window.clearInterval(timerIntervalId);
        updatePPMData();
        startCountdown();
    }, 60500);
    startCountdown();
});

function parseHashCommand() {
    if (document.location.hash.length > 1) {
        var cmd = document.location.hash.substr(1);
        if (cmd != "all") {
            var split = cmd.split('/');
            if (split.length == 1) {
                viewOperator(split[0]);
                return;
            } else if (split.length == 2) {
                viewSubRegion(split[0], split[1]);
                return;
            }
        }
    } 
    showAll();
}

function startCountdown() {
    title.next(60);
    timerIntervalId = setInterval(function () {
        title.next(title.next()-1);
    }, 1000);
}

function updatePPMData() {
    for (var i = 0; i < data().length; i++){
        var model = data()[i];
        $.getJSON("http://" + server + ":" + apiPort + "/PPM/", {
            operatorCode: model.Code(),
            name: model.Operator()
        }).done(function (sectorData) {
            updateModel(sectorData);
        });
        for (var j = 0; j < model.Regions().length; j++) {
            $.getJSON("http://" + server + ":" + apiPort + "/PPM/", {
                operatorCode: model.Regions()[j].Code(),
                name: model.Regions()[j].Operator()
            }).done(function (sectorData) {
                updateRegionModel(sectorData);
            });
        }
    }
}

function getPPMSectors() {
    return $.getJSON("http://" + server + ":" + apiPort + "/PPM/")
        .done(function (ppmSectors) {
            if (ppmSectors && ppmSectors.length > 0) {
                for (i in ppmSectors) {
                    var model = new PPMViewModel(ppmSectors[i]);
                    data.push(model);
                    $.getJSON("http://" + server + ":" + apiPort + "/PPM/" + model.Code()
                    ).then(function (regions) {
                        updateRegions(regions);
                    }).done(function () {
                        parseHashCommand();
                    });
                }
            }
        }).done(function () {
            updatePPMData();
        });
}

function updateRegions(regions) {
    if (!regions || regions.length == 0)
        return;
    for (var i = 0; i < data().length; i++) {
        var el = data()[i];
        if (el.Code() == regions[0].OperatorCode) {
            for (var j = 0; j < regions.length; j++) {
                el.Regions.push(new PPMViewModel(regions[j], el));
            }
            break;
        }
    }
}

function updateModel(sectorData) {
    // if array
    if ($.isArray(sectorData))
        sectorData = sectorData[0];

    if (!sectorData || ($.isArray(sectorData) && sectorData.length == 0))
        return;

    title.ts(moment(sectorData.Timestamp).format("ddd DD/MM/YYYY HH:mm:ss"));
    for (var i = 0; i < data().length; i++) {
        if (data()[i].Operator() == sectorData.Name && data()[i].Code() == sectorData.Code) {
            data()[i].updateStats(sectorData);
            break;
        }
    }
}

function updateRegionModel(sectorData) {
    // if array
    if ($.isArray(sectorData))
        sectorData = sectorData[0];

    if (!sectorData || ($.isArray(sectorData) && sectorData.length == 0))
        return;

    for (var i = 0; i < data().length; i++) {
        var el = data()[i];
        if (el.Code() == sectorData.Code) {
            var reg = el.Regions();
            for (var j = 0; j < reg.length; j++) {
                if (reg[j].Operator() == sectorData.Name) {
                    reg[j].updateStats(sectorData);
                    break;
                }
            }
            break;
        }
    }
}

function showAll() {
    $("#commandOptions > li.active").removeClass("active");
    $("#commandOptions > li:nth-child(2)").addClass("active");

    $("#ppmTable").show();
    $("#ppmOperator").hide();
    document.location.hash = "all";

    return false;
}

function viewOperator(id) {
    var model = null;
    for (var i = 0; i < data().length; i++) {
        if (data()[i].Id() == id) {
            model = data()[i];
            break;
        }
    }    
    if (!model)
        return;

    if (!_currentOperator) {
        _currentOperator = ko.observable(model);
        ko.applyBindings(_currentOperator, $("#ppmOperator").get(0));
    } else {
        _currentOperator(model);
    }

    updateOperatorPage();

    return false;
}

var _currentOperator;

function updateOperatorPage() {
    var opId = _currentOperator().Id();
    var hash = _currentOperator().Id();
    if (_currentOperator().Parent.IsRegion) {
        opId = _currentOperator().Parent.Id();
        hash = _currentOperator().Parent.Id() + "/" + hash;
    }
    $("#commandOptions > li.active").removeClass("active");
    $("#commandOptions > li#op-" + opId).addClass("active");

    $("#ppmOperator").show();
    $("#ppmTable").hide();

    document.location.hash = hash;
}

function viewSubRegion(parentId, regionId) {
    var model = null;
    for (var i = 0; i < data().length; i++) {
        if (data()[i].Id() == parentId) {
            model = data()[i];
            break;
        }
    }
    if (!model || !model.Regions() || model.Regions().length == 0)
        return;

    var region = null;
    for (var i = 0; i < model.Regions().length; i++) {
        if (model.Regions()[i].Id() == regionId) {
            region = model.Regions()[i];
            break;
        }
    }

    if (region != null) {
        if (!_currentOperator) {
            _currentOperator = ko.observable(region);
            ko.applyBindings(_currentOperator, $("#ppmOperator").get(0));
        } else {
            _currentOperator(region);
        }

        updateOperatorPage();

        return false;
    }
}