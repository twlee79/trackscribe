import math
def graph_scale_test(min_value,max_value):
  tick_relscales = [5,2,1]
  min_numticks = 4
  max_numticks = 8

  val_range = max_value - min_value
  val_range_mag = math.floor(math.log10(val_range))

  for tick_mag in [10**val_range_mag,10**(val_range_mag-1)]:
    for tick_relscale in tick_relscales:
      tick_scale = tick_relscale*tick_mag
      print tick_scale
      max_tick_val = math.ceil(max_value/tick_scale) * tick_scale
      min_tick_val = math.floor(min_value/tick_scale) * tick_scale
      num_ticks = (max_tick_val-min_tick_val)/tick_scale + 1
      print max_tick_val,min_tick_val,num_ticks,num_ticks>=min_numticks and num_ticks<=max_numticks

def graph_scale_test2(min_value,max_value):
  print min_value,max_value
  assert(max_value>min_value)
  tick_relscales = [1,2,5]
  min_numticks = 4
  max_numticks = 8

  val_range = max_value - min_value
  val_range_mag = math.floor(math.log10(val_range))

  for tick_mag in [10**(val_range_mag-1),10**val_range_mag]:
    for tick_relscale in tick_relscales:
      # don't tick tick_relscale of 1 and mag 10**(val_range_mag-1) can ever be used with <11 ticks
      tick_scale = tick_relscale*tick_mag
      max_tick_val = math.ceil(max_value/tick_scale) * tick_scale
      min_tick_val = math.floor(min_value/tick_scale) * tick_scale
      num_ticks = int((max_tick_val-min_tick_val)/tick_scale + 1)
      print tick_scale,min_tick_val,max_tick_val,num_ticks,num_ticks>=min_numticks and num_ticks<=max_numticks

graph_scale_test2(2,30)
graph_scale_test2(1,3)
graph_scale_test2(0.3,10)
graph_scale_test2(5,600)
graph_scale_test2(7,58)
graph_scale_test2(531,600)
graph_scale_test2(-531,600)
graph_scale_test2(-400,600)
graph_scale_test2(-400,599.5)
graph_scale_test2(-0.3,600)
graph_scale_test2(600,31)