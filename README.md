# Arbovirus Modeling and Prediction to Forecast Mosquito-Borne Disease Outbreaks (ArboMAP)

ArboMAP is a set of software to be used in the RStudio environment to model and predict vector-borne diseases, especially arboviruses transmitted by mosquitoes. 

**ArboMAP_User_Guide.pdf** contains information on installation and use of ArboMAP. New users should begin by reading through the file completely.  

**ArboMAP_Main_Code.Rmd** contains code for generating weekly forecasting reports.

**GRIDMET_downloader_v2_1.js** contains code for the Google Earth Engine application for environmental data access.  

**ArboMAP.Rproj** is an RStudio project that can be used to run the code and will allow the programs to find all the necessary data.

The various directories contain either example input data or example outputs from ArboMAP.

**Important Note:** the human and mosquito data that come packaged with ArboMAP are synthetic data, created by
first fitting the model on West Nile virus in South Dakota, and then generating human cases and
mosquito pools according to that model. Hence, while they are consistent with the overall trends
of actual data, they are not the actual data, and must not be used as a basis for scientific inference. Rather,
they are provided so that the user can see an example of the code working well with realistic data.

ArboMAP was developed by the [EcoGRAPH](http://ecograph.net) research group at the University of Oklahoma with support from NASA. We are happy to answer your questions, and we would appreciate feedback on how these tools could be improved. Please contact mcwimberly@ou.edu for questions about the arbovirus modeling project.

Copyright (C) 2019, J. Davis and M. Wimberly

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as
published by the Free Software Foundation, version 3. This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details. You should have received a copy of the GNU General Public License along with
this program. If not, see <http://www.gnu.org/licenses/>.

**Version information:**

v3.1

- The main script to run ArboMAP, ArboMAP_Main_Code.Rmd, now can be adjusted using parameters via utilizing RStudio's "Knit with Parameters" feature. This allows for making modifications without changing the original settings. 
- Minor bug fixes and re-organization of the project. 

v3.0

- There are now multiple methods of summarizing the mosquito infection data, apart from the original stratified mosquito infection growth rate. This now includes the estimated intercept (MII, stratified or not) and the area under the estimated mosquito infection curve (AUC). There is also the simple ratio of positive pools to total pools tested (simpleratio).
- Flat mosquito data (i.e. mosquito data presented solely as positive pools and total pools tested per year) can be resampled by referencing timed mosquito data from another source.

v2.3

- The user is now required to tell ArboMAP which years of which data can be believed. This is helpful, for example, to differentiate a year completely lacking human cases and a year in which human cases actually occurred, but these data have not been made available to ArboMAP.
- Predictions can be produced arbitrarily far into the past and future, rather than restricting estimates to wherever mosquito infection data exist.
- The user no longer has to provide shapefiles - these are downloaded during the run by the tigris package. This does mean that analyses not based on US states will require some modification.
- If a year has believable human data but no associated mosquito infection data, previous versions were unable to produce estimates for that year. Now, we create an indicator variable that fits the intercept for that year, allowing the human data to still be used, for example to relate to the environmental data. If a year has neither believable human nor believable mosquito data, the user may still request estimates based on environmental data (which themselves might be missing). In that case, the mosquito data are assumed to be average and no special fit is performed with an indicator.
- The method by which random effects from the MIGR model were derived has been changed. Instead of using the predict function, which occasionally produced inappropriate results (due to interaction with tibbles, numerics being forcibly converted to factors, etc.), we now draw the random effects directly from the model summary.

v2.2

- Instead of asking the user to repeatedly run varying models in separate instances of ArboMAP, the user may now specify multiple models directly by building formulas in the settings.
- A number of changes to graphing, including the graphing of smoothed components from each model. These do not currently have the best names, since they are created by gam, and will require some interpretation by the user.
- It is likely that the user will observe long stretches of no human infections, especially during winter months. We have adjusted the modeling so that a certain portion of outlying cases are truncated before modeling, and only cases during the main body of the transmission season are used for modeling. This improves model fit, stability, run time, etc.
- Some changes to the User's Guide to reflect the above changes. These are not yet complete and the user should take care in creating new formulas for new models to run.
- An attempt has been made to allow ArboMAP to run on Mac machines. This seems to be a question solely of filenames and will be revisited in future releases if these changes do not suffice.

v2.1

- ArboMAP now allows the comparison of fixed-degree cubic vs. thin-plate splines, seasonally-varying distributed lags vs. fixed lags, and anomalized environmental/human data vs. raw data.
- These different combinations can be compared directly with AIC, AUC, and the Hosmer-Lemeshow goodness-of-fit test, which are included automatically in a new set of outputs in the main PDF.
- Model objects are saved automatically in a new directory, so that post hoc analyses not yet available in ArboMAP can be performed.
- Fixed a problem with a sometimes-missing directory.
- We have addressed some concerns over numerical stability when combining anomalization and seasonally-varying distributed lags, which in parametric models would be unidentifiable/overdetermined.
- We have redone some of the simulated data, so that the outcomes with default settings are more reasonable.

v2.0

- The updated mgcv library now allows us to use thin-plate splines in place of cubic regression splines. Wherever possible in ArboMAP, thin-plate splines are used instead of cubic-regression splines. The user has an option to use the old cr splines (fixeddfcr), but this is not advised. The user is required to update the mgcv library, as all but the most recent versions do not handle the formulas correctly. Namely, the bam(..., discrete=TRUE) method required an update to handle linear functionals correctly.
- Additional information is now given in ArboMAP, including the estimated distribted lags and the per-variable effects of the weather.
- An updated calculation for the cases (rather than positive county-weeks) is now included.
- The js code to download the environmental data from GEE has been streamlined due to occasional memory issues encountered on GEE. Namely, the interface now displays the raw rather than anomalized weather data.
- An oddity in rendering the interface has been corrected, and the outline of all counties should be correctly displayed. This may take several seconds.
- An error in the js code was returning FIPS rather than district names. For the sake of clarity we will eventually work with the FIPS rather than string names, but for the moment names (e.g. "Broward County" rather than 12011) are used.

v1.0 

- We used informal versioning in all instances of ArboMAP before 2.0, at which point we began using github's release system. All previous version should be considered relatively obsolete, since updates to mgcv allow us to use better estimators.
