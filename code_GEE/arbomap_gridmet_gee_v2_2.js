// GRIDMET Viewer and Downloader Version 2.2
//
// Developed as part of the Arbovirus Modeling and Prediction System
//
// Description: This Google Earth Engine script was developed to facilitate 
// access to county-level summaries of gridded meteorological data to support 
// West Nile virus forecasting. Users can select a U.S. state and date range 
// and download a table of summarized meteorological data. Users can also 
// explore maps of daily temperature anomalies, precipitation, vapor pressure 
// deficit, and relative humidity via the graphical user interface.
// 
// Developed by: Michael C. Wimberly, Justin K. Davis, Dawn M. Nekorchuk
//               University of Oklahoma
//               Department of Geography and Environmental Sustainability
//               mcwimberly@ou.edu
//
// Last Update: April 20, 2022

//
// Data Imports 
//

var gridmet = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET"),
    counties = ee.FeatureCollection("TIGER/2016/Counties"),
    states = ee.FeatureCollection("TIGER/2016/States");

//
// Calculation 
//

// Step 1: Set up and define the global variables

// Start and end dates for the visualization option (any date)
// and for calculations that will be filtered 
// by user date input to be exported.
var startDate = ee.Date('2000-01-01');
var now = Date.now();
// Get max (latest) data datetime.
var gridmetMax = gridmet.reduceColumns({
  reducer: ee.Reducer.max(), 
  selectors: ["system:time_start"]
});
var maxDate = ee.Date(gridmetMax.get('max'));
// Filters are end date *exclusive*, so adding day here for ease.
var endDate = maxDate.advance(1, 'days');

// Create list of dates for time series.
var nDays = endDate.difference(startDate, 'day');
var dates = ee.List.sequence(0, nDays, 1);
var makeDateList = function(n) {
  return startDate.advance(n, 'day');
};
dates = dates.map(makeDateList);

// Include our selected states and filter out states 
// that are *not* in CONUS .
var notConus = ["2","15","60","66","69","72","78"]; 
var conus = counties
    .filter(ee.Filter.inList('STATEFP', notConus).not());
var conusStates = states
    .filter(ee.Filter.inList('STATEFP', notConus).not());

// Create dictionary of state FIPS codes (STATEFP) and state names
// state name is NOT a field in counties file, 
// which is why states was needed (fieldname: NAME)
var stateDictionary = ee.Dictionary.fromLists(
  conusStates.aggregate_array('NAME'), 
  conusStates.aggregate_array('STATEFP')
);

// Step 2: Calculate the summary variables

// Filter by date and select the variables of interest:
// Precipitation, min and max relative humidity, 
// min and max daily temperature, 
// and mean daily vapor pressure deficit.
var gridmetFiltered = gridmet
  .filterDate(startDate, endDate)
  .select(['pr', 'rmax', 'rmin', 'tmmn', 'tmmx', 'vpd', 'vs'],
          ['pr', 'rmax', 'rmin', 'tmin', 'tmax', 'vpd', 'vs']);

// Function to calculate derived variables 
// and add them to the image collection.
var addVars = function(image) {
  // Mean relative humidity.
  var rmean = image
      .select(['rmax', 'rmin'])
      .reduce(ee.Reducer.mean())
      .rename('rmean');
  // Convert temperatures from Kelvin (K) to Celsius (C).
  var tminc = image
      .select('tmin')
      .subtract(273.15)
      .rename('tminc');
  var tmaxc = image
      .select('tmax')
      .subtract(273.15)
      .rename('tmaxc');
  // Mean daily temperature
  var tmeanc = ee.Image([tminc, tmaxc])
      .reduce(ee.Reducer.mean())
      .rename('tmeanc');
  // Extract year and day of year information.
  var curdate = ee.Date(image.get('system:time_start'));
  var curyear = curdate.get('year');
  var curdoy = curdate.getRelative('day', 'year').add(1);  

  return image
          .addBands(rmean)
          .addBands(tminc)
          .addBands(tmaxc)
          .addBands(tmeanc)
          .select('rmean', 'tminc', 'tmaxc', 'tmeanc', 'pr', 'vpd', 'vs')
          .set('doy', curdoy)
          .set('year', curyear);
}; 

// Map the function over the filtered gridmet collection.
var gridmetCalculated = gridmetFiltered.map(addVars);

//
// Download summaries
//

// Step 3: Calculate the zonal statistics

// Function to calculate and export zonal stats based on input from the UI.
var exportZonal = function() {

  // Filter the image collection by state and date range.
  // Parse and filter by the FIPS code
  // use dictionary to get fips code for selected state 
  // from drop down selector (state name).
  var stateNameString = String(fipsInput.getValue());
  var stateFips = stateDictionary.get(stateNameString);
  var selectedState = counties
      .filter(ee.Filter.eq('STATEFP', stateFips));
  
  // Parse dates from the UI.
  var userStartDateText = startDateInput.getValue();
  var userEndDateText = endDateInput.getValue();
  var userStartDate = ee.Date(userStartDateText);
  var userEndReqDate = ee.Date(userEndDateText);
  // End date is exclusive, so add 1 day here.
  var userEndDate = userEndReqDate.advance(1, 'days');

  // Filter by date range.
  var gridmetSummarized = gridmetCalculated
      .filterDate(userStartDate, userEndDate);

  // Function to calculate zonal statistics by county:
  var zonalSum = function(image) { 
    // To get the doy and year, 
    // convert the metadata to grids and then summarize.
    var image2 = image.addBands([
      image.metadata('doy'), 
      image.metadata('year')
    ]);
    // Reduce by regions to get zonal means for each county.
    var output = image2
        .select(['tmeanc', 'tminc', 'tmaxc', 'pr', 'rmean', 'vpd', 'vs', 'doy', 'year'])
        .reduceRegions({
           collection: selectedState,
          reducer: ee.Reducer.mean()
    });
    return output;
  };
  // Map function over summarized data. 
  var countiesSum = gridmetSummarized.map(zonalSum);
  // Rename fields appropriately.
  var oldNames = ["NAME", "GEOID", "doy", "year", 
                  "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd", "vs"];
  var newNames = ["district", "fips", "doy", "year", 
                  "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd", "vs"];
  // Feature collection needs to be flattened 
  // to yield one record for for each combination of county and date.
  var exportData = countiesSum
      .flatten().select(oldNames, newNames, false);
                
  // Create file name
  var exportPrefix = "gridmet";
  // Rename all whitespace in the state name to use for filename.
  var stateNameStringClean = stateNameString.replace(/\s/g, "");
  var outputFilename = exportPrefix
      .concat("_", stateNameStringClean, 
              "_", userStartDateText, 
              "_", userEndDateText);
  
  // Need to click "RUN in the Tasks tab to configure and start the export.
  // Note: when run from app, this will still 'run' but they won't have 
  //  access to the Tasks tab, and will use the web download links below.
  Export.table.toDrive({
    collection: exportData,
    description: outputFilename,
    selectors: newNames
  });
  
  // Create download URLs to display.
  var exportURL = exportData
      .getDownloadURL({
        format: 'csv',
        filename: outputFilename,
        selectors: newNames
  });

  // Add download links to UI.
  // Link construction:
  var linkSection = ui.Chart(
    [
      ['Download data'],
      ['<a target = "_blank" href = '+exportURL+' style = "color: blue">' + 
      'Download link: ' +outputFilename+'</a>'],
    ],
    'Table', {allowHtml: true});
    // Make link panel.
    downloadPanel = ui.Panel(
      [linkSection], 
      ui.Panel.Layout.Flow('vertical')
    );
    map.add(downloadPanel);
};

//
// User Interface Code & Visualization
//

// Main UI sections:
var map = ui.Map();
var sidePanel = ui.Panel({
  style: {
    height: '100%',
    width: '25%',
    }
});

// Global variable, to be able to add/remove 
//  from inside or outside of functions.
var downloadPanel = ui.Panel();

//// Map ////

// Initially center of the map on CONUS.
map.setCenter(-85, 39, 4);

// Palettes for environmental variable maps.
var paletteWater = ['f7fbff', '08306b']; 
var paletteTemp = ['fff5f0', '67000d']; 
var paletteOther = ['ffffe5', '6d0182']; 

// Function to visualize the layers:
// Gets updated whenever visualization date are changed 
//  or a new state selected.
var updateMap = function() {
  
  map.layers().reset();
  
  // Get year and threshold information from the slides.
  // Note: Value is an array: [date, date+1] as number.
  var visDateArray = visualizeDateSelector.getValue(); 
  
  var imgVisualized = gridmetCalculated
      .filterDate(ee.Date(visDateArray[0]), 
                  ee.Date(visDateArray[1]))
       //.first() to turn imageCollection of 1 image into image.
       .first();

  var temp = imgVisualized.select('tmeanc');
  var rh = imgVisualized.select('rmean');
  var vpd = imgVisualized.select('vpd');
  var vs = imgVisualized.select('vs');
  var pr = imgVisualized.select('pr');
  
  var tempminmax = temp.reduceRegion(ee.Reducer.minMax());
  var tempmin    = ee.Number(tempminmax.get('tmeanc_min')).add(0);
  var tempmax    = ee.Number(tempminmax.get('tmeanc_max')).add(0);
  var tempnorm   = temp
      .subtract(tempmin)
      .divide(tempmax.subtract(tempmin));
  
  var rhminmax = rh.reduceRegion(ee.Reducer.minMax());
  var rhmin    = ee.Number(rhminmax.get('rmean_min')).add(0);
  var rhmax    = ee.Number(rhminmax.get('rmean_max')).add(0);
  var rhnorm   = rh
      .subtract(rhmin)
      .divide(rhmax.subtract(rhmin));
  
  var vpdminmax = vpd.reduceRegion(ee.Reducer.minMax());
  var vpdmin    = ee.Number(vpdminmax.get('vpd_min')).add(0);
  var vpdmax    = ee.Number(vpdminmax.get('vpd_max')).add(0);
  var vpdnorm   = vpd
      .subtract(vpdmin)
      .divide(vpdmax.subtract(vpdmin));
  
  var prminmax = pr.reduceRegion(ee.Reducer.minMax());
  var prmin    = ee.Number(prminmax.get('pr_min')).add(0);
  var prmax    = ee.Number(prminmax.get('pr_max')).add(0);
  var prnorm   = pr
      .subtract(prmin)
      .divide(prmax.subtract(prmin));
  
  map.addLayer(
    rhnorm, 
    {min: 0, max: 1, palette: paletteWater}, 
    'Relative Humidity', 
    false);
  map.addLayer(
    vpdnorm, 
    {min: 0, max: 1, palette: paletteOther}, 
    'Vapor Pressure Deficit', 
    false);
  map.addLayer(
    prnorm, 
    {min: 0, max: 1, palette: paletteWater}, 
    'Precipitation', 
    false);
  // Only showing temperature initially.
  map.addLayer(
    tempnorm, 
    {min: 0, max:1, palette: paletteTemp}, 
    'Temperature'); 

  // Use dictionary to get fips code for selected state 
  // from drop down selector (state name).
  var visFips = stateDictionary
      .get(String(fipsInput.getValue()));
  print('visFips', visFips);
  var visState = counties
      .filter(ee.Filter.eq('STATEFP', visFips));
  print('visState', visState);
  // Create an empty image into which to paint the features, cast to byte.
  var empty = ee.Image().byte();
  var visCounties = empty.paint({
    featureCollection: visState,
    width: 1
  });
  map.addLayer(
    visCounties,
    {color: '000000'},
    'counties'
  );  
};

//// Side Panel ////

// Default date prep
// Default is the last month of available data.
var defaultDownloadStart = maxDate.advance(-1, 'months');

// Create an intro panel.
var introPanel = ui.Panel([
  ui.Label({
    value: 'GRIDMET Viewer & Data Downloader',
    style: {fontSize: '20px', fontWeight: 'bold'}
  }),
  ui.Label({
    value: "Version 2.2, Released 2022-04-20"
  }),
  ui.Label({
    value: 'This Google Earth Engine script facilitates access to county-level ' +
    'summaries of gridded meteorological data to support West Nile virus forecasting, ' +
    'however it can be also used for any application needing these data. ' +
    'Users can select a U.S. state and date range ' + 
    'to download a table of summarized meteorological data by county. ' +
    'Users can also explore maps of daily temperature anomalies, precipitation, ' +
    'vapor pressure deficit, and relative humidity.'})
]);
sidePanel.add(introPanel);

// Visualization Date

//Slider for picking date to visualize on map.
var visualizeHeader = ui.Label({
    value: 'Viewer:',
    style: {fontSize: '16px', fontWeight: 'bold'}
  });
var visualizeDateLabel = ui.Label({
  value: 'To visualize weather data on the map, ' +
  'select a date from the available data in the slider or calendar below. ' + 
  'Under the Layers dropdown menu on the map you can select ' + 
  'which weather variable you want to see.',
  style: {fontSize: '14px'}
});
var visualizeDateSelector = ui.DateSlider({
  start: startDate,
  end: endDate, // To show last available date in SLIDER.
  value: maxDate, // Default for PICKER (and slider).
  onChange: updateMap,
  style: {
    stretch: 'horizontal',
    maxWidth: '250px'
  },
});
var visualizeDatePanel = ui.Panel({
  widgets: [
    visualizeHeader, 
    visualizeDateLabel, 
    visualizeDateSelector
    ],
  layout: ui.Panel.Layout.flow('vertical')
});
sidePanel.add(visualizeDatePanel);

// Code for creating the State FIPS box
//https://gis.stackexchange.com/questions/330277/using-ui-select-for-administrative-levels-dropdown-in-google-earth-engine
//https://gis.stackexchange.com/questions/368590/incorporate-location-selection-drop-down-widget-into-split-panel-earth-engine-ap
//https://developers.google.com/earth-engine/guides/ui_widgets#ui.select

// Download: FIPS

var fipsHeader = ui.Label({
    value: 'Downloader:',
    style: {fontSize: '16px', 
            fontWeight: 'bold'}
  });
var fipsLabel = ui.Label({
  value: 'Select a state and dates to download daily data by county.',
  style: {fontSize: '14px'}
});
var fipsInput = ui.Select({
  // Using the dictionary, display the keys (state names)
  items: stateDictionary.keys().getInfo(),
  value: "South Dakota", //default
  onChange: function(value){
    print('selector onchange value', value);
    updateMap();
    map.remove(downloadPanel);
  }
});

var fipsPanel = ui.Panel({
  widgets: [fipsHeader, 
            fipsLabel, 
            fipsInput],
  layout: ui.Panel.Layout.flow('vertical')
});
sidePanel.add(fipsPanel);

// Download: Dates

// Start date box.
var startDateLabel = ui.Label({
    value: 'Download start date:',
    style: {fontSize: '14px', fontWeight: 'bold'}
  });
var startDateInput = ui.Textbox({
  value: defaultDownloadStart
          .format('YYYY-MM-dd').getInfo(),
  onChange: function(value){
    map.remove(downloadPanel)},
  style: {stretch: 'vertical'}
});
var startDatePanel = ui.Panel({
  widgets: [startDateLabel, 
            startDateInput],
  layout: ui.Panel.Layout.flow('vertical')
});
sidePanel.add(startDatePanel);

// End date box.
var endDateLabel = ui.Label({
    value: 'Download end date ' +
      '(default latest available data date):',
    style: {fontSize: '14px', fontWeight: 'bold'}
  });
var endDateInput = ui.Textbox({
  value: maxDate
          .format('YYYY-MM-dd').getInfo(),
  onChange: function(value){
    map.remove(downloadPanel)},
  style: {stretch: 'vertical'}
});
var endDatePanel = ui.Panel({
  widgets: [endDateLabel, 
            endDateInput],
  layout: ui.Panel.Layout.flow('vertical')
});
sidePanel.add(endDatePanel);

// Download button.
var exportButton = ui.Button({
  label: 'Click for summary downloads',
  onClick: exportZonal
});
var exportDesc = ui.Label(
  'If running from the Code Editor, ' +
  'run the task that appears in the Task tab in the upper right pane. ' +
  'If running from the app, '+
  'use the download links that appear at the top center of the map.');
var codeLink = ui.Label(
    'Access to Code Editor version (must have Google Earth Engine account)',
    {color: 'blue'},
    'https://code.earthengine.google.com/bcda40fa0d9f6b8aea64653c381c0862');
var exportPanel = ui.Panel({
  widgets: [exportButton, 
            exportDesc, 
            codeLink],
  layout: ui.Panel.Layout.flow('vertical')
});
sidePanel.add(exportPanel);


//extra information panel
var addl1Label = ui.Label('Developed as part of the ' + 
                  'Arbovirus Modeling and Prediction System (ArboMAP)');
var addl2Label = ui.Label(
  'ArboMAP West Nile Forecasting System on Github',
  {padding: '0px', color: 'blue'},
  'https://github.com/EcoGRAPH/ArboMAP');
var addl3Label = ui.Label('Developed by: ' +
                    'Michael C. Wimberly, Justin K. Davis, Dawn M. Nekorchuk');
var addl4Label = ui.Label(
  'EcoGRAPH Research Group at the University of Oklahoma',
  {padding: '0px', color: 'blue'},
  'http://ecograph.net');
var addl5Label = ui.Label(
    'Contact: Dr. Michael C. Wimberly',
    {padding: '0px', color: 'blue'},
    'mailto:mcwimberly@ou.edu?subject=ArboMAP GRIDMET GEE Viewer & Downloader');
var addl6Label = ui.Label(
  'More about GRIDMET data',
  {padding: '0px', color: 'blue'},
  'https://www.climatologylab.org/gridmet.html');
var addlPanel = ui.Panel(
  [addl1Label, 
   addl2Label, 
   addl3Label, 
   addl4Label, 
   addl5Label, 
   addl6Label],
  '', 
  {padding: '0px 0px 0px 0px'});
sidePanel.add(addlPanel);

var splitPanel = ui.SplitPanel({
    firstPanel: sidePanel,
    secondPanel: map,
});
ui.root.clear();
ui.root.add(splitPanel);

//Initial draw.
updateMap();