# Arbovirus Modeling and Prediction to Forecast Mosquito-Borne Disease Outbreaks (ArboMAP)

ArboMAP is a set of software to be used in the RStudio envionment to model and predict vector-borne diseases, especially arboviruses transmitted by mosquitoes. 

**ArboMAP_User_s_Guide.pdf** contains information on installation and use of ArboMAP. New users should begin by reading through the file completely.  
**ArboMAP Main Code.Rmd** contains code for generating weekly forecasting reports.  
**ArboMAP Variable Selection** contains code for selecting the best subset of climate variables to use with the arbovirus prediction model.  
**ArboMAP User's Guide.Rmd** contains code for generating the user guide.  
**GRIDMET_dowmloader_v1_0.js** contains code for the Google Earth Engine application for environmental data access.  
**ArboMAP.Rproj** is an RStudio project that can be used to run the code and will allow the programs to find all the necessary data.

The various directories contain either example input data or example outputs from ArboMAP.

**Important Note:** the human and mosquito data that come packaged with ArboMAP are synthetic data, created by
first fitting the model on West Nile virus in South Dakota, and then generating human cases and
mosquito pools according to that model. Hence, while they are consistent with the overall trends
of actual data, they are not the actual data, and must not be used as a basis for scientific inference. Rather,
they are provided so that the user can see an example of the code working well with realistic data.

ArboMAP was developed by the [EcoGRAPH](http://ecograph.net) research group at the University of Oklahoma with support from NASA. We are happy to answer your questions, and we would appreciate feedback on how these tools could be improved. Please contact justinkdavis@ou.edu for technical issues about the code, or mcwimberly@ou.edu for questions about the arbovirus modeling project.
