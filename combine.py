# usage [combine_corpus.py $corpus_folder]
import os
import sys
import numpy as np

corpus = sys.argv[1]
folder = os.path.join('data', 'xml_sep', corpus)

corpus_sep = sorted(os.listdir(folder))
corpus_all = []

output = open(os.path.join('data', 'combined_new', corpus+'.xml'), "w")

for i, sep in enumerate(corpus_sep):
	sep = os.path.join(folder, sep)
	with open(sep) as f:
		txt = f.readlines()

	for j, line in enumerate(txt):
		if j == 0 and i != 0:
			line = line.replace("<ThdlPrototypeExport>", "")
		if j == len(txt)-1 and i != len(corpus_sep) - 1:
			line = line.replace("</ThdlPrototypeExport>", "")

		output.write(line)

output.close()