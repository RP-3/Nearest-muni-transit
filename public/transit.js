//for details of geometric calculations, see http://www.movable-type.co.uk/scripts/latlong.html

var lat, lon;
var R = 6371; // earth radius in km
var toRadians = (Math.PI/180);

//get users location from browser
window.onload=function(){
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(pos){
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    });
  }else{
    alert("This widget won't work. Either you or your browser have/has disabled geolocation");
  }
}

var completeTransitSet;

//set up firebase listener
var myDataRef = new Firebase('https://publicdata-transit.firebaseio.com/sf-muni');
myDataRef.on('value', function(snapshot){
  console.log('updated');
  completeTransitSet = (snapshot.val()).data;
});

//filter for given vehicle type
var filterFor = function(vType){
  var result = {};
  for (key in completeTransitSet){
    if (completeTransitSet[key].vtype === vType){
      result[key] = completeTransitSet[key];
    }
  }
  return result;
}

//add distance property to vehicles in group
var findDistance = function(group){
	for(key in group){
		var φ1 = (group[key].lat) * toRadians;
		var φ2 = lat * toRadians;
		var Δφ = (lat - group[key].lat) * toRadians;
		var Δλ = (lon - group[key].lon) * toRadians;
		//approximated using haversine formula
		var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
		        Math.cos(φ1) * Math.cos(φ2) *
		        Math.sin(Δλ/2) * Math.sin(Δλ/2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

		group[key].distance = R * c;
	}
}

//add bearing property to group
var findBearing = function(group){
	for(key in group){
		var φ1 = (group[key].lat) * toRadians;
		var φ2 = lat * toRadians;
		var Δφ = (lat - group[key].lat) * toRadians;
		var Δλ = (lon - group[key].lon) * toRadians;
		//varying value! lookup orthodrome formula
		var y = Math.sin(lon-group[key].lon) * Math.cos(lat);
		var x = Math.cos(group[key].lat)*Math.sin(lat) - 
		Math.sin(group[key].lat)*Math.cos(lat)*Math.cos(lon-group[key].lon);

		group[key].brng = Math.atan2(y, x)*(1/toRadians);
	}
}

//find closest x vehicles from given group
var findClosest = function(group, count){
	var result = [];

	for (key in group){ result.push(group[key]); }

	result.sort(function(a, b){
		if(a.distance < b.distance){ return -1; }
		if(a.distance > b.distance){ return 1; }
	});

	result = result.slice(0, count);
	findBearing(result);
	return result;
}















