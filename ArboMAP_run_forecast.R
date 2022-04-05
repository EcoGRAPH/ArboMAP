if (!require("pacman")) install.packages("pacman"); library(pacman); pacman::p_load(rmarkdown); rmarkdown::render("ArboMAP_forecast.Rmd", params = "ask")

