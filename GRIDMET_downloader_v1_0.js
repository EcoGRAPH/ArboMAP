///////////////////////////////////////////////////////////////////////////////
// GRIDMET Viewer and Downloader Version 1.0
// Developed as part of the Arbovirus Modeling and Prediction System
// Description: This Google Earth Engine script was developed to facilitate access to
// county-level summaries of gridded meteorological data to support West Nile virus 
// forecasting. Users can select a U.S. state and date range and download a table of
// summarized meteorological data. Users can also explore maps of daily temperature 
// anomalies via the graphical user interface.
// 
// Developed by: 	Michael C. Wimberly
//					South Dakota State University
//					Geospatial Sciences Center of Excellence
//					michael.wimberly@sdstate.edu
//
// Last Update: August 1, 2018
////////////////////////////////////////////////////////////////////////////////

//var counties = ee.FeatureCollection("ft:1S4EB6319wWW2sWQDPhDvmSBIVrD3iEmCLYB7nMM"),
//    gridmet = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET");

var counties = ee.FeatureCollection('TIGER/2016/Counties'),
    gridmet = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET");

////////////////////////////////////////////////////////////////////////////////
// Step 1: Define the global parameters for the script
////////////////////////////////////////////////////////////////////////////////

// Initially center of the map on CONUS
Map.setCenter(-85, 39, 4);

// Start and end dates for the data summary
var startdate = ee.Date('1999-01-01');
var enddate = ee.Date('2018-12-31');

// One or more states for which to do county-level summaries
var mystates = "46";

// Create list of dates for time series
var n_days = enddate.difference(startdate, 'day');
var dates = ee.List.sequence(0, n_days, 1);
var make_datelist = function(n) {
  return startdate.advance(n, 'day');
};
dates = dates.map(make_datelist);
 
// include only our selected state
var selectedstate = counties.filter(ee.Filter.equals("STATEFP",mystates));
// Create an empty image into which to paint the features, cast to byte.
var empty = ee.Image().byte();
var countybound = empty.paint({
  featureCollection: selectedstate,
  color: 1,
  width: 3
});
Map.addLayer(countybound,{color: '000000'},'counties');  

////////////////////////////////////////////////////////////////////////////////
// Step 2: Calculate the summary variables
////////////////////////////////////////////////////////////////////////////////

// Filter by date and select the variables of interest
// Precip, min and max relative humidity, min and max daily temp, and mean daily 
// vapor pressure deficit
var gridmet_filt = gridmet
  .filterDate(startdate, enddate)
  .select(['pr', 'rmax', 'rmin', 'tmmn', 'tmmx', 'vpd'],
          ['pr', 'rmax', 'rmin', 'tmin', 'tmax', 'vpd']);

// Function to calculate derived variables and add them to the image collection
var addvars = function(image) {
  // Mean relative humidity
  var rmean = image.select(['rmax', 'rmin'])
                   .reduce(ee.Reducer.mean())
                   .rename('rmean');
  // Concvert temperatures from K to C
  var tminc = image.select('tmin')
                   .subtract(273.15)
                   .rename('tminc');
  var tmaxc = image.select('tmax')
                   .subtract(273.15)
                   .rename('tmaxc');
  // Mean daily temperature
  var tmeanc = ee.Image([tminc, tmaxc])
                   .reduce(ee.Reducer.mean())
                   .rename('tmeanc');
  // Take log of precipitation (not currently adding an offset, so zero precip
  // will become NODATA
  var logpr = image.select('pr')
                   .log()
                   .rename('logpr');                 
  // Extract year and day of year information
  var curdate = ee.Date(image.get('system:time_start'));
  var curyear = ee.Date(curdate).get('year');
  var curdoy = ee.Date(curdate).getRelative('day', 'year').add(1);  
  // Add new image bands and set new properties
  return image.addBands(rmean)
              .addBands(tminc)
              .addBands(tmaxc)
              .addBands(tmeanc)
              .addBands(logpr)
              .set('doy', curdoy)
              .set('year', curyear);
}; 

// Map the function over the filtered gridmet collection
var gridmet_calc = gridmet_filt.map(addvars);

////////////////////////////////////////////////////////////////////////////////
// Step 3: Calculate climate anomalies
////////////////////////////////////////////////////////////////////////////////

// DOY list for generating anomalies
var doy_list = ee.List.sequence(1, 366, 1);

// Calculate long-term mean for each DOY from the climatology
var mean_calc = function(doy) {
  var gridmet_doy = gridmet_calc.filter(ee.Filter.dayOfYear(doy, doy));
  var meanmet = gridmet_doy.reduce(ee.Reducer.mean());
  return meanmet.set('doy', doy);
};

// Calculate long-term standard deviation for each DOY from the climatology
var stdev_calc = function(doy) {
  var gridmet_doy = gridmet_calc.filter(ee.Filter.dayOfYear(doy, doy));
  var meanmet = gridmet_doy.reduce(ee.Reducer.stdDev());
  return meanmet.set('doy', doy);
};

// Map and mean and stdev functions across the daily image collection
// Convert the resutls to lists so we can extract individual images
var daily_mean = ee.ImageCollection.fromImages(doy_list.map(mean_calc));
var daily_stdev = ee.ImageCollection.fromImages(doy_list.map(stdev_calc));
var mean_list = daily_mean.toList(daily_mean.size());
var stdev_list = daily_stdev.toList(daily_stdev.size());

// Function to calculate daily anomalies 
var anomcalc = function(image) {
  // Determin DOY of the current image
  var curdoy = image.get('doy');
  // Extract long-term meana and stdev for that DOY
  var curindex = ee.Number(curdoy).subtract(1);
  var cur_mean = ee.Image(mean_list.get(curindex));
  var cur_stdev = ee.Image(stdev_list.get(curindex));
  // Calculate temperature anomaly
  var tm_anom = image.select('tmeanc')
                     .subtract(cur_mean.select('tmeanc_mean'))
                     .divide(cur_stdev.select('tmeanc_stdDev'))
                     .rename('tm_anom');
  // Calculate relative humidity anomaly
  var rhm_anom = image.select('rmean')
                     .subtract(cur_mean.select('rmean_mean'))
                     .divide(cur_stdev.select('rmean_stdDev'))
                     .rename('rhm_anom');
  // Calculate vapor pressure deficit anomalies
  var vpd_anom = image.select('vpd')
                     .subtract(cur_mean.select('vpd_mean'))
                     .divide(cur_stdev.select('vpd_stdDev'))
                     .rename('vpd_anom');
  // Calculate log precip anomaly
  var logpr_anom = image.select('logpr')
                     .subtract(cur_mean.select('logpr_mean'))
                     .divide(cur_stdev.select('logpr_stdDev'))
                     .rename('logpr_anom');
  // Add anomaly variables to the image collection
  return image.addBands(tm_anom)
              .addBands(rhm_anom)
              .addBands(vpd_anom)
              .addBands(logpr_anom);
};

// Map the anomaly function over the image collection
var gridmet_anom = gridmet_calc.map(anomcalc);

////////////////////////////////////////////////////////////////////////////////
// Step 4: Calculate the zonal statistics
////////////////////////////////////////////////////////////////////////////////

// Function to calculate and export zonal stats based on input from the UI
var exportzonal = function() {

  var sdtext = sdinput.getValue();
  var edtext = edinput.getValue();
  var sddate = ee.Date(sdtext);
  var eddate = ee.Date(edtext);
  // Filter the image collection
  // Map the function over the image collection
  var curstate_sum = fipsinput.getValue();
  var statenum_sum = curstate_sum;
  var gridmet_sum = gridmet_calc.filterDate(sddate, eddate);
 // Function to calculate zonal statistics by county
  var zonalsum = function(image) { 
    // To get the doy and year, we conver the metadata to grids and then summarize
    var image2 = image.addBands([image.metadata('doy'), image.metadata('year')]);
    // Reduce by regions to get zonal means for each county
    var output = image2.select(['tmeanc', 'tminc', 'tmaxc', 'pr', 'rmean', 'vpd', 'doy', 'year'])
                       .reduceRegions({
                         collection: selectedstate,
                         reducer: ee.Reducer.mean(),
                         scale: 4000});
    return output;
  };
  var cnty_sum = gridmet_sum.map(zonalsum);                  
  // Feature collection needs to be "flattened" to yield one record for for each 
  // combination of county and date
  // Need to click "RUN in the Tasks tab to configure and start the export
  var oldnames = ["NAME", "doy", "year", "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd"];
  var newnames = ["district", "doy", "year", "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd"];
  
  var newdf = cnty_sum.flatten().select(oldnames, newnames, false);

  Export.table.toDrive({
    collection: newdf,
    selectors: newnames
  });
  
};

////////////////////////////////////////////////////////////////////////////////
// User Interface Code
////////////////////////////////////////////////////////////////////////////////

var tempPal = ['blue', 'red']; // store palette as variable

// Function to visualize the layers
// Gets updated whenever slides are moved or a new state is entered
var showLayer = function() {
  Map.layers().reset();
  // Get year and threshold information from the slides
  var curyear = yearindex.getValue();
  var curdoy = dateindex.getValue();
  var curstate = fipsinput.getValue();
  var statenum = Number(curstate);
  var selectedstate = counties.filter(ee.Filter.equals("STATEFP",curstate));
  var init_date = ee.Date.fromYMD(curyear, 1, 1);
  var img_date = init_date.advance(curdoy, 'day');
  var img_filt = gridmet_anom.filter(ee.Filter.calendarRange(curyear, curyear, 'year'))
                             .filter(ee.Filter.calendarRange(curdoy, curdoy, 'day_of_year'));
  var gridmet_list = img_filt.toList(img_filt.size());
  var img_cur = ee.Image(gridmet_list.get(0));
  var meantemp = img_cur.select('tm_anom');
  var meanrh = img_cur.select('rhm_anom');
  var meanvpd = img_cur.select('vpd_anom');
  var sumpr = img_cur.select('logpr_anom');
  Map.addLayer(meantemp, {min: -2, max: 2, palette: tempPal}, 'tmeanc');
  //Map.addLayer(meanrh, {min: -2, max: 2, palette: tempPal}, 'meanrh');
  //Map.addLayer(meanvpd, {min: -2, max: 2, palette: tempPal}, 'meanrh');
  //Map.addLayer(sumpr, {min: -2, max: 2, palette: tempPal}, 'sumpr');

  var countybound = empty.paint({
    featureCollection: selectedstate,
    color: 1,
    width: 3
  });
  Map.addLayer(countybound,{color: '000000'},'counties');  
};

// Create a panel on the left side of the map to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '400px'); // Can change the width of the panel here

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'GRIDMET Viewer and Downloader',
    style: {fontSize: '20px', fontWeight: 'bold'}
  }),
  ui.Label('Adjust sliders to select a year and DOY to view daily temperature anomalies.'),
  ui.Label('Enter a state FIPS code and dates to download daily data by county.')
]);
panel.add(intro);

//// Code for creating the sliders////
// Select year slider
var yearlabel = ui.Label({
    value: 'Select Year',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var yearindex = ui.Slider({
  min: 2000,
  max: 2018,
  step: 1,
  onChange: showLayer, 
  style: {stretch: 'vertical',
          width: '365px'
  }
});
var yearPanel = ui.Panel({
  widgets: [yearlabel, yearindex],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Select day of year slider
var datelabel = ui.Label({
    value: 'Select Day of Year',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var dateindex = ui.Slider({
  min: 1,
  max: 365,
  step: 1,
  onChange: showLayer, 
  style: {stretch: 'vertical',
          width: '365px'
  }
});
var datePanel = ui.Panel({
  widgets: [datelabel, dateindex],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the State FIPS box
var fipslabel = ui.Label({
    value: 'Enter the State FIPS code for Summary',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var fipsinput = ui.Textbox({
  placeholder: 'State FIPS',
  onChange: showLayer,
  style: {stretch: 'vertical'}
});
var fipsPanel = ui.Panel({
  widgets: [fipslabel, fipsinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the start date box
var sdlabel = ui.Label({
    value: 'Start Date for Summary',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var sdinput = ui.Textbox({
  placeholder: 'YYYY-MM-DD',

  style: {stretch: 'vertical'}
});
var sdPanel = ui.Panel({
  widgets: [sdlabel, sdinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the end date box
var edlabel = ui.Label({
    value: 'End Date for Summary',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var edinput = ui.Textbox({
  placeholder: 'YYYY-MM-DD',

  style: {stretch: 'vertical'}
});
var edPanel = ui.Panel({
  widgets: [edlabel, edinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the download button
var exlabel = ui.Label({
    value: 'Click Button to Generate Summary',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var exinput = ui.Button({
  label: 'Download Summary',
  onClick: exportzonal
});
var exPanel = ui.Panel({
  widgets: [exlabel, exinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});


// Add the panels to the map and set default values.
panel.widgets().set(1, yearPanel);
yearindex.setValue(2010);
panel.widgets().set(2, datePanel);
dateindex.setValue(165);
panel.widgets().set(3, fipsPanel);
fipsinput.setValue(46);
panel.widgets().set(4, sdPanel);
panel.widgets().set(5, edPanel);
panel.widgets().set(6, exPanel);

// Add the panel to the ui.root.
ui.root.insert(0, panel);