import os
inpath = '..\marker99.svg'

replaceToken = '>99<'
for i in xrange(0,100):
  infile = open(inpath,'r')
  outfile = open('temp.svg','w')
  for line in infile:
    line = line.replace('font-family="\'Arial-BoldMT\'"','font-family="Arial" font-weight="600" text-anchor="middle"' )
    line = line.replace(replaceToken,'>%i<'%i)
    outfile.write(line)
  infile.close()
  outfile.close()

  os.system('convert +antialias -background none -density 10 temp.svg ../markers/marker_%i.png'%i)
