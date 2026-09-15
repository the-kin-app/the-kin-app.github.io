"""Illustrative steady-state Min scenarios; not a dated forecast."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
NET_SUB=19.99/1.255*.8*12
STAGES=[('Early rollout',10,5000,.6e6),('Regional',80,60000,1.5e6),('Multi-market',400,300000,5e6),('International',1000,500000,8e6),('Large network',3000,1500000,20e6),('Global network',6000,3000000,35e6)]
CASES={'Downside':(12000,.03,.05),'Target':(20000,.06,.15),'Upside':(24000,.08,.25)}
def model(stage,case):
 name,communities,consumer,overhead=stage
 price,conversion,bookings=CASES[case]
 sponsored=communities*500
 mau=sponsored+consumer
 contract=communities*price
 premium=consumer*conversion*NET_SUB
 booking_count=mau*bookings*12
 activities=booking_count*4
 receipts=contract+premium+activities
 delivery=mau*.4*12+communities*2000+booking_count*.75
 maintenance=communities*.12*12000+consumer*.08*12*12
 return dict(stage=name,scenario=case,communities=communities,eligible_sponsored=communities*2000,sponsored_mau=sponsored,consumer_mau=consumer,mau=mau,payers=consumer*conversion,bookings=booking_count,contracts=contract,premium=premium,activities=activities,recurring_receipts=contract+premium,receipts=receipts,delivery=delivery,contribution=receipts-delivery,maintenance_acquisition=maintenance,fixed_overhead=overhead,operating_surplus=receipts-delivery-maintenance-overhead)
rows=[model(s,c) for c in CASES for s in STAGES]
assert all(r['mau']==r['sponsored_mau']+r['consumer_mau'] for r in rows)
assert all(abs(r['receipts']-r['contracts']-r['premium']-r['activities'])<1e-6 for r in rows)
(ROOT/'scenarios.json').write_text(json.dumps(rows,indent=2)+'\n')
for r in rows:
 if r['scenario']=='Target' or r['mau']==1000000:
  print(r['scenario'],r['stage'],r['mau'], 'receipts',round(r['receipts']), 'surplus',round(r['operating_surplus']))
