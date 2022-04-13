if (!require("pacman")) install.packages("pacman"); library(pacman); pacman::p_load(rmarkdown); rmarkdown::render("ArboMAP_forecast.Rmd", params = "ask", output_format = "pdf_document"); system2("open", "ArboMAP_forecast.pdf")


