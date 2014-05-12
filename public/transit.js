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

var completeSet;
 
//set up firebase listener
var myDataRef = new Firebase('https://publicdata-transit.firebaseio.com/sf-muni');
myDataRef.on('value', function(snapshot){
  console.log('updated');
  completeSet = (snapshot.val()).data;
  getDataAndDraw();
});

//filter for given vehicle type
var filterFor = function(vType, data){
  var result = {};
  for (var key in data){
    if (data[key].vtype === vType && data.hasOwnProperty(key)){
      result[key] = data[key];
    }
  }
  return result;
}

//add distance property to vehicles in group
var findDistance = function(group){
	for(var key in group){
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
	for(var key in group){
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

	for (var key in group){ result.push(group[key]); }

	result.sort(function(a, b){
		if(a.distance < b.distance){ return -1; }
		if(a.distance > b.distance){ return 1; }
	});

	result = result.slice(0, count);
	findBearing(result);
	return result;
}

var format = function(data){
	var result = [];
	for (var i=0; i<data.length; i++){
		var temp = {};
		temp.value = data[i].distance;
		temp.label = data[i].routeTag + " : " + 
					(data[i].distance*1000).toFixed(0) + 
					"m; " + data[i].heading+"°";
		result.push(temp);
	}
	return result;
}

var getDataAndDraw = function(){
	var fireData = filterFor("bus", completeSet);
	findDistance(fireData);
	var vehicleData = findClosest(fireData, 5);
	vehicleData = format(vehicleData);
	change(vehicleData);
}

//******General Update Pattern*********//

//var update = function(data){

var svg = d3.select("body")
	.append("svg")
	.append("g")

svg.append("g")
	.attr("class", "slices");
svg.append("g")
	.attr("class", "labels");
svg.append("g")
	.attr("class", "lines");

var width = 960,
    height = 450,
	radius = Math.min(width, height) / 2;

var pie = d3.layout.pie()
	.sort(null)
	.value(function(d) {
		return d.value;
	});

var arc = d3.svg.arc()
	.outerRadius(radius * 0.8)
	.innerRadius(radius * 0.4);

var outerArc = d3.svg.arc()
	.innerRadius(radius * 0.9)
	.outerRadius(radius * 0.9);

svg.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")", "rotate(45 50 50)");

var key = function(d){ return d.data.label; };

var color = d3.scale.ordinal()
	.domain([1, 2, 3, 4, 5])
		//, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
	.range(["#5D8AA8", "#72A0C1", "#E32636", "#C46210", "#3B7A57"])
		//, "#FFBF00", "#FF7E00", "#3B444B", "#E9D66B", "#87A96B", "#FF9966", "#A52A2A"]);

function randomData (){
	var labels = color.domain();
	return labels.map(function(label){
		return { label: label, value: Math.random() }
	});
}

//change(randomData());

d3.select(".randomize")
	.on("click", function(){
		change(randomData());
	});


function change(data) {
	/* ------- PIE SLICES -------*/
	var slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(data), key);

	slice.enter()
		.insert("path")
		.style("fill", function(d) { return color(d.data.label); })
		.attr("class", "slice");

	slice		
		.transition().duration(1000)
		.attrTween("d", function(d) {
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				return arc(interpolate(t));
			};
		})

	slice.exit()
		.remove();

	/* ------- TEXT LABELS -------*/

	var text = svg.select(".labels").selectAll("text")
		.data(pie(data), key);

	text.enter()
		.append("text")
		.attr("dy", ".35em")
		.text(function(d) {
			return d.data.label;
		});
	
	function midAngle(d){
		return d.startAngle + (d.endAngle - d.startAngle)/2;
	}

	text.transition().duration(1000)
		.attrTween("transform", function(d) {
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				var d2 = interpolate(t);
				var pos = outerArc.centroid(d2);
				pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1);
				return "translate("+ pos +")";
			};
		})
		.styleTween("text-anchor", function(d){
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				var d2 = interpolate(t);
				return midAngle(d2) < Math.PI ? "start":"end";
			};
		});

	text.exit()
		.remove();

	/* ------- SLICE TO TEXT POLYLINES -------*/

	var polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(data), key);
	
	polyline.enter()
		.append("polyline");

	polyline.transition().duration(1000)
		.attrTween("points", function(d){
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				var d2 = interpolate(t);
				var pos = outerArc.centroid(d2);
				pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
				return [arc.centroid(d2), outerArc.centroid(d2), pos];
			};			
		});
	
	polyline.exit()
		.remove();
};

//};














