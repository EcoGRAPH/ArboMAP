///////////////////////////////////////////////////////////////////////////////
// GRIDMET Viewer and Downloader Version 2.1
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
// Developed by: Michael C. Wimberly, Justin K. Davis, Dawn Nekorchuk
//               University of Oklahoma
//               Department of Geography and Environmental Sustainability
//               mcwimberly@ou.edu
//
// Last Update: June 11, 2021
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
//
// Data Imports 
//

var counties = ee.FeatureCollection("TIGER/2016/Counties"),
    gridmet = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET");


////////////////////////////////////////////////////////////////////////////////
//
// Visualization and Calculation 
//

////////////////////////////////////////////////////////////////////////////////
// Step 1: Set up and define the global variables
////////////////////////////////////////////////////////////////////////////////

//used in UI default dates
var now = Date.now(); 

// Initially center of the map on CONUS
Map.setCenter(-85, 39, 4);

// Start and end dates for the visualization option (any date)
// and calculations that will be filtered by user date input to be exported
var startdate = ee.Date('2000-01-01'); //if change, change the min value in slider
var enddate = ee.Date(now);

// Create list of dates for time series
var n_days = enddate.difference(startdate, 'day');
var dates = ee.List.sequence(0, n_days, 1);
var make_datelist = function(n) {
  return startdate.advance(n, 'day');
};
dates = dates.map(make_datelist);
 
// Include our selected states and filter out states that are *not* in CONUS 
var nonCONUS = ["2","15","60","66","69","72","78"]; // state FIPS codes that we don't want
var conus = counties.filter(ee.Filter.inList('STATEFP',nonCONUS).not());

////////////////////////////////////////////////////////////////////////////////
// Step 2: Calculate the summary variables
////////////////////////////////////////////////////////////////////////////////

// Filter by date and select the variables of interest
// Precip, min and max relative humidity, min and max daily temp, and mean daily 
// vapor pressure deficit
var gridmet_filt = gridmet
  .filterDate(startdate, enddate)
  .select(['pr', 'rmax', 'rmin', 'tmmn', 'tmmx', 'vpd', 'vs'],
          ['pr', 'rmax', 'rmin', 'tmin', 'tmax', 'vpd', 'vs']);

// Function to calculate derived variables and add them to the image collection
var addvars = function(image) {
  // Mean relative humidity
  var rmean = image.select(['rmax', 'rmin'])
                   .reduce(ee.Reducer.mean())
                   .rename('rmean');
  // Convert temperatures from K to C
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
  // Extract year and day of year information
  var curdate = ee.Date(image.get('system:time_start'));
  var curyear = curdate.get('year');
  var curdoy = curdate.getRelative('day', 'year').add(1);  

  return image.addBands(rmean)
              .addBands(tminc)
              .addBands(tmaxc)
              .addBands(tmeanc)
              .select('rmean', 'tminc', 'tmaxc', 'tmeanc', 'pr', 'vpd', 'vs')
              .set('doy', curdoy)
              .set('year', curyear);
     
}; 

// Map the function over the filtered gridmet collection
var gridmet_calc = gridmet_filt.map(addvars);


////////////////////////////////////////////////////////////////////////////////
//
// Download summaries
//

////////////////////////////////////////////////////////////////////////////////
// Step 3: Calculate the zonal statistics
////////////////////////////////////////////////////////////////////////////////

// Function to calculate and export zonal stats based on input from the UI
var exportzonal = function() {

  // Filter the image collection by state and date range
  
  //parse and filter by the FIPS code
  var stateFIPS = String(fipsinput.getValue());
  var sumstate = counties.filter(ee.Filter.eq('STATEFP',stateFIPS));
  
  //parse dates from UI
  var sdtext = sdinput.getValue();
  var edtext = edinput.getValue();
  var sddate = ee.Date(sdtext);
  var eddate = ee.Date(edtext);

  print("Dates for zonal summary:");
  print(sddate);
  print(eddate);

  //filter by date range
  var gridmet_sum = gridmet_calc.filterDate(sddate, eddate);

  // Function to calculate zonal statistics by county
  var zonalsum = function(image) { 
    // To get the doy and year, we conver the metadata to grids and then summarize
    var image2 = image.addBands([image.metadata('doy'), image.metadata('year')]);
    // Reduce by regions to get zonal means for each county
    var output = image2.select(['tmeanc', 'tminc', 'tmaxc', 'pr', 'rmean', 'vpd', 'vs', 'doy', 'year'])
                       .reduceRegions({
                       collection: sumstate,
                       reducer: ee.Reducer.mean()});
    return output;
  };
  //map function over
  var cnty_sum = gridmet_sum.map(zonalsum);
  //set up to rename fields
  var oldnames = ["NAME", "doy", "year", "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd", "vs"];
  var newnames = ["district", "doy", "year", "tminc", "tmeanc", "tmaxc", "pr", "rmean", "vpd", "vs"];
  // Feature collection needs to be "flattened" to yield one record for for each 
  // combination of county and date
  var newdf = cnty_sum.flatten().select(oldnames, newnames, false);
                
  //create file name
  var exportPrefix = "export_data";
  var outputFilename = exportPrefix.concat("_fips", stateFIPS, "_", sdtext, "_", edtext);
  
  print(outputFilename);

  // Need to click "RUN in the Tasks tab to configure and start the export
  Export.table.toDrive({
    collection: newdf,
    description: outputFilename,
    selectors: newnames
  });
};

////////////////////////////////////////////////////////////////////////////////
//
// User Interface Code
//

// Palettes for environmental variable maps
var paletteWater = ['f7fbff', '08306b']; 
var paletteTemp = ['fff5f0', '67000d']; 
var paletteOther = ['ffffe5', '6d0182']; 
//var tempPal = ['blue', 'red']; // store palette as variable

// Create an empty image into which to paint the features, cast to byte.
var empty = ee.Image().byte();

// Function to visualize the layers
// Gets updated whenever slides are moved or a new state is entered
var showLayer = function() {
  
  Map.layers().reset();
  
  // Get year and threshold information from the slides
  var curyear = yearindex.getValue();
  var curdoy = dateindex.getValue();
  var stateFIPS = String(fipsinput.getValue());
  var displaystate = counties.filter(ee.Filter.eq('STATEFP',stateFIPS));
  
  var init_date = ee.Date.fromYMD(curyear, 1, 1);
  var img_date = init_date.advance(curdoy, 'day');
  var img_filt = gridmet_calc.filterDate(img_date, img_date.advance(1, 'day')).first();
  
  var temp = img_filt.select('tmeanc');
  var rh = img_filt.select('rmean');
  var vpd = img_filt.select('vpd');
  var vs = img_filt.select('vs');
  var pr = img_filt.select('pr');
  
  var tempminmax = temp.reduceRegion(ee.Reducer.minMax());
  var tempmin    = ee.Number(tempminmax.get('tmeanc_min')).add(0);
  var tempmax    = ee.Number(tempminmax.get('tmeanc_max')).add(0);
  var tempnorm   = temp.subtract(tempmin).divide(tempmax.subtract(tempmin));
  
  var rhminmax = rh.reduceRegion(ee.Reducer.minMax());
  var rhmin    = ee.Number(rhminmax.get('rmean_min')).add(0);
  var rhmax    = ee.Number(rhminmax.get('rmean_max')).add(0);
  var rhnorm   = rh.subtract(rhmin).divide(rhmax.subtract(rhmin));
  
  var vpdminmax = vpd.reduceRegion(ee.Reducer.minMax());
  var vpdmin    = ee.Number(vpdminmax.get('vpd_min')).add(0);
  var vpdmax    = ee.Number(vpdminmax.get('vpd_max')).add(0);
  var vpdnorm   = vpd.subtract(vpdmin).divide(vpdmax.subtract(vpdmin));
  
  var prminmax = pr.reduceRegion(ee.Reducer.minMax());
  var prmin    = ee.Number(prminmax.get('pr_min')).add(0);
  var prmax    = ee.Number(prminmax.get('pr_max')).add(0);
  var prnorm   = pr.subtract(prmin).divide(prmax.subtract(prmin));
  
  Map.addLayer(rhnorm, {min: 0, max: 1, palette: paletteWater}, 'Relative Humidity');
  Map.addLayer(vpdnorm, {min: 0, max: 1, palette: paletteOther}, 'Vapor Pressure Deficit');
  Map.addLayer(prnorm, {min: 0, max: 1, palette: paletteWater}, 'Precipitation');
  Map.addLayer(tempnorm, {min: 0, max:1, palette: paletteTemp}, 'Temperature');

  var countybound = empty.paint({
    featureCollection: displaystate,
    width: 1
  });
  Map.addLayer(countybound,{color: '000000'},'counties');  
};

// Default date prep
var defaultDownloadStart = ee.Date(now).advance(-1, 'months');
//calculate a default doy for the slider
//doy of default 1-month-ago start date. Note: indexing starts at 0, so add 1
var defaultDoy = defaultDownloadStart.getRelative('day', 'year').add(1);

// Create a panel on the left side of the map to hold our widgets.
var panel = ui.Panel();
panel.style().set('width', '400px'); // Can change the width of the panel here

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'GRIDMET Viewer and Downloader',
    style: {fontSize: '20px', fontWeight: 'bold'}
  }),
  ui.Label('Viewer: Adjust sliders to select a year and doy to view daily weather data ' +
  '(adjust which variable you want to see under Layers dropdown menu on the map).'),
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
  max: enddate.get('year').format().getInfo(),
  step: 1,
  value: defaultDownloadStart.get('year').getInfo(),
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
  value: defaultDoy.getInfo(),
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
var fipsheader = ui.Label('Downloader: Enter a state FIPS code and dates to download daily data by county.');
//https://www.census.gov/library/reference/code-lists/ansi/ansi-codes-for-states.html

var fipslabel = ui.Label({
    value: 'Enter the State FIPS Code',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var fipsref = ui.Label(
  'Reference for FIPS code lookup',
  {},
  'https://www.census.gov/library/reference/code-lists/ansi/ansi-codes-for-states.html');
var fipsinput = ui.Textbox({
  placeholder: 'State FIPS', //not currently used
  onChange: showLayer,
  style: {stretch: 'vertical'}
});

var fipsPanel = ui.Panel({
  widgets: [fipsheader, fipslabel, fipsref, fipsinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the start date box
var sdlabel = ui.Label({
    value: 'Start Date for Summary Download',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var sdinput = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: defaultDownloadStart.format('YYYY-MM-dd').getInfo(),
  style: {stretch: 'vertical'}
});
var sdPanel = ui.Panel({
  widgets: [sdlabel, sdinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the end date box
var edlabel = ui.Label({
    value: 'End Date for Summary Download',
    style: {fontSize: '17px', fontWeight: 'bold'}
  });
var edinput = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: ee.Date(now).format('YYYY-MM-dd').getInfo(),
  style: {stretch: 'vertical'}
});
var edPanel = ui.Panel({
  widgets: [edlabel, edinput],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});

// Code for creating the download button
//var exlabel = ui.Label({
//    value: 'Click Button to Generate Task for Download Summary',
//    style: {fontSize: '17px', fontWeight: 'bold'}
//  });
var exinput = ui.Button({
  label: 'Click to Generate Task for Download Summary',
  onClick: exportzonal
});
var exPanel = ui.Panel({
  widgets: [exinput],//exlabel
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '7px'}
});


// Add the panels to the map and set default values.
panel.widgets().set(1, yearPanel);
panel.widgets().set(2, datePanel);
panel.widgets().set(3, fipsPanel);
fipsinput.setValue("46"); //SD //done here to trigger display
panel.widgets().set(4, sdPanel);
panel.widgets().set(5, edPanel);
panel.widgets().set(6, exPanel);

// Add the panel to the ui.root.
ui.root.insert(0, panel);
