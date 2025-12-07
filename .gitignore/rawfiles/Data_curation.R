#Plants data
Plant<-read.delim(sep="\t", "D:/GitPage/.gitignore/rawfiles/Biterdata2.txt")
Plant_curated<-aggregate(Plant$Description, by=list(Plant$Title, Plant$Section), function(x) paste(x, collapse = "\n"))
colnames(Plant_curated)<-colnames(Plant)

Plant_curated