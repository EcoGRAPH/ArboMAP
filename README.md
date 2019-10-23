# Arbovirus Modeling and Prediction to Forecast Mosquito-Borne Disease Outbreaks (ArboMAP)

ArboMAP is a set of software to be used in the RStudio envionment to model and predict vector-borne diseases, especially arboviruses transmitted by mosquitoes. 

**ArboMAP_User_s_Guide.pdf** contains information on installation and use of ArboMAP. New users should begin by reading through the file completely.  
**ArboMAP Main Code.Rmd** contains code for generating weekly forecasting reports.  
**ArboMAP Variable Selection** contains code for selecting the best subset of climate variables to use with the arbovirus prediction model.  
**ArboMAP User's Guide.Rmd** contains code for generating the user guide.  
**GRIDMET_dowmloader.js** contains code for the Google Earth Engine application for environmental data access.  
**ArboMAP.Rproj** is an RStudio project that can be used to run the code and will allow the programs to find all the necessary data.

The various directories contain either example input data or example outputs from ArboMAP.

**Important Note:** the human and mosquito data that come packaged with ArboMAP are synthetic data, created by
first fitting the model on West Nile virus in South Dakota, and then generating human cases and
mosquito pools according to that model. Hence, while they are consistent with the overall trends
of actual data, they are not the actual data, and must not be used as a basis for scientific inference. Rather,
they are provided so that the user can see an example of the code working well with realistic data.

ArboMAP was developed by the [EcoGRAPH](http://ecograph.net) research group at the University of Oklahoma with support from NASA. We are happy to answer your questions, and we would appreciate feedback on how these tools could be improved. Please contact justinkdavis@ou.edu for technical issues about the code, or mcwimberly@ou.edu for questions about the arbovirus modeling project.

Copyright (C) 2019, J. Davis and M. Wimberly

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as
published by the Free Software Foundation, version 3. This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details. You should have received a copy of the GNU General Public License along with
this program. If not, see <http://www.gnu.org/licenses/>.

**Version information:**

v2.0

- The updated mgcv library now allows us to use thin-plate splines in place of cubic regression splines. Wherever possible in ArboMAP, thin-plate splines are used instead of cubic-regression splines. The user has an option to use the old cr splines (fixeddfcr), but this is not advised. The user is required to update the mgcv library, as all but the most recent versions do not handle the formulas correctly. Namely, the bam(..., discrete=TRUE) method required an update to handle linear functionals correctly.
- Additional information is now given in ArboMAP, including the estimated distribted lags and the per-variable effects of the weather.
- An updated calculation for the cases (rather than positive county-weeks) is now included.
- The js code to download the environmental data from GEE has been streamlined due to occasional memory issues encountered on GEE. Namely, the interface now displays the raw rather than anomalized weather data.
- An oddity in rendering the interface has been corrected, and the outline of all counties should be correctly displayed. This may take several seconds.
- An error in the js code was returning FIPS rather than district names. For the sake of clarity we will eventually work with the FIPS rather than string names, but for the moment names (e.g. "Broward County" rather than 12011) are used.

v1.0 

- We used informal versioning in all instances of ArboMAP before 2.0, at which point we began using github's release system. All previous version should be considered relatively obsolete, since updates to mgcv allow us to use better estimators.
