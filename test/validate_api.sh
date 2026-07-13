#!/bin/sh
set -eu
BASE=http://localhost:3000

echo 'POST /drivers d1'
curl -s -X POST "$BASE/drivers" -H 'Content-Type: application/json' -d '{"id":"test-d1","lon":77.5946,"lat":12.9716}'
echo '\nPOST /drivers d2'
curl -s -X POST "$BASE/drivers" -H 'Content-Type: application/json' -d '{"id":"test-d2","lon":77.5950,"lat":12.9718}'
echo '\nPOST /drivers/test-d1/available'
curl -s -X POST "$BASE/drivers/test-d1/available" -H 'Content-Type: application/json' -d '{"available":true}'
echo '\nPOST /rides'
RIDE_JSON=$(curl -s -X POST "$BASE/rides" -H 'Content-Type: application/json' -d '{"lon":77.5946,"lat":12.9716}')
echo "$RIDE_JSON"
RIDE_ID=$(printf '%s' "$RIDE_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin)["rideId"])')
echo "\nrideId=$RIDE_ID"
echo "\nPOST /rides/$RIDE_ID/accept"
curl -s -X POST "$BASE/rides/$RIDE_ID/accept" -H 'Content-Type: application/json' -d '{"driverId":"test-d1"}'
echo "\nGET /rides/$RIDE_ID"
curl -s "$BASE/rides/$RIDE_ID"
echo '\nDone'
